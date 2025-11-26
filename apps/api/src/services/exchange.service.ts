/**
 * Servicio de Conversión de Monedas
 * Obtiene el tipo de cambio USD/UYU con cache en memoria y Firestore
 */

import { db } from "../lib/firebase.js";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "../lib/monitoring.js";

interface ExchangeRateCache {
  rate: number;
  date: string; // YYYY-MM-DD
  source: string;
  timestamp: number;
}

// Cache en memoria (rápido)
let memoryCache: ExchangeRateCache | null = null;
const MEMORY_CACHE_MS = 6 * 60 * 60 * 1000; // 6 horas
const FIRESTORE_CACHE_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene el tipo de cambio USD/UYU
 * Prioridad:
 * 1. Cache en memoria (si es reciente)
 * 2. Cache en Firestore (distribuido)
 * 3. API pública de tipo de cambio
 * 4. Valor por defecto configurado
 */
export async function getUSDToUYUExchangeRate(): Promise<number> {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Verificar cache en memoria
  if (memoryCache && (now - memoryCache.timestamp) < MEMORY_CACHE_MS) {
    return memoryCache.rate;
  }

  // 2. Verificar cache en Firestore (distribuido entre instancias)
  try {
    const cacheDoc = await db.collection("_cache").doc("exchange_rates").get();
    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      const cacheTimestamp = data?.timestamp?.toMillis?.() || 0;
      if ((now - cacheTimestamp) < FIRESTORE_CACHE_MS && data?.USD_UYU) {
        memoryCache = {
          rate: data.USD_UYU,
          date: today,
          source: 'firestore-cache',
          timestamp: now
        };
        return data.USD_UYU;
      }
    }
  } catch (e) {
    logger.warn('Error leyendo cache de Firestore', e as Error);
  }

  // 3. Obtener de API pública
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      const rate = data.rates?.UYU;
      
      if (rate && typeof rate === 'number' && rate > 0) {
        // Guardar en memoria
        memoryCache = { rate, date: today, source: 'exchangerate-api', timestamp: now };
        
        // Guardar en Firestore (async, no bloquea)
        db.collection("_cache").doc("exchange_rates").set({
          USD_UYU: rate,
          timestamp: Timestamp.now(),
          source: 'exchangerate-api'
        }).catch(e => logger.warn('Error guardando cache', e as Error));
        
        return rate;
      }
    }
  } catch (error) {
    logger.warn('Error obteniendo tipo de cambio de API', error as Error);
  }

  // 4. Fallback: usar cache viejo o valor por defecto (actualizado Nov 2025)
  const defaultRate = parseFloat(process.env.DEFAULT_USD_UYU_RATE || '42.0');
  
  if (memoryCache) {
    logger.info(`Usando tipo de cambio cacheado: ${memoryCache.rate}`);
    return memoryCache.rate;
  }

  logger.warn(`Usando tipo de cambio por defecto: ${defaultRate}`);
  memoryCache = { rate: defaultRate, date: today, source: 'default', timestamp: now };
  return defaultRate;
}

/**
 * Convierte un monto de una moneda a otra
 */
export async function convertCurrency(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // Si es la misma moneda, no convertir
  if (fromCurrency === toCurrency) {
    return amountCents;
  }

  // Solo soportamos conversión USD -> UYU por ahora
  if (fromCurrency === 'USD' && toCurrency === 'UYU') {
    const rate = await getUSDToUYUExchangeRate();
    return Math.round(amountCents * rate);
  }

  // Si es UYU -> USD, invertir la conversión
  if (fromCurrency === 'UYU' && toCurrency === 'USD') {
    const rate = await getUSDToUYUExchangeRate();
    return Math.round(amountCents / rate);
  }

  // Monedas no soportadas, retornar sin convertir
  logger.warn(`Conversión no soportada: ${fromCurrency} -> ${toCurrency}`);
  return amountCents;
}

/**
 * Convierte múltiples montos a la moneda base
 */
export async function convertToBaseCurrency(
  transactions: Array<{ amountCents: number; currencyCode: string }>,
  baseCurrency: string
): Promise<number> {
  let total = 0;

  for (const tx of transactions) {
    if (tx.currencyCode === baseCurrency) {
      total += tx.amountCents;
    } else {
      const converted = await convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency);
      total += converted;
    }
  }

  return total;
}

/**
 * Obtiene el tipo de cambio actual (para mostrar al usuario)
 */
export async function getCurrentExchangeRate(): Promise<{ rate: number; date: string; source: string }> {
  const rate = await getUSDToUYUExchangeRate();
  return {
    rate,
    date: memoryCache?.date || new Date().toISOString().slice(0, 10),
    source: memoryCache?.source || 'default'
  };
}

/**
 * Obtiene el rate de conversión entre dos monedas (optimizado para batch)
 * Retorna un Map con los rates necesarios
 */
export async function getExchangeRatesMap(
  fromCurrencies: string[],
  toCurrency: string
): Promise<Map<string, number>> {
  const rateMap = new Map<string, number>();
  
  // Obtener rate USD/UYU una vez
  if (fromCurrencies.includes('USD') && toCurrency === 'UYU') {
    const rate = await getUSDToUYUExchangeRate();
    rateMap.set('USD->UYU', rate);
  } else if (fromCurrencies.includes('UYU') && toCurrency === 'USD') {
    const rate = await getUSDToUYUExchangeRate();
    rateMap.set('UYU->USD', 1 / rate);
  }
  
  // Agregar conversión identidad
  rateMap.set(`${toCurrency}->${toCurrency}`, 1);
  
  return rateMap;
}

/**
 * Convierte un monto usando un rate pre-calculado (síncrono, para batch)
 */
export function convertAmountWithRate(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string,
  rateMap: Map<string, number>
): number {
  if (fromCurrency === toCurrency) {
    return amountCents;
  }
  
  const key = `${fromCurrency}->${toCurrency}`;
  const rate = rateMap.get(key);
  
  if (rate === undefined) {
    logger.warn(`Rate not found for ${key}, returning original amount`);
    return amountCents;
  }
  
  return Math.round(amountCents * rate);
}

/**
 * Fuerza la actualización del tipo de cambio (limpia cache)
 */
export function clearExchangeRateCache(): void {
  memoryCache = null;
}

/**
 * Wrapper seguro para conversión de monedas
 * Valida resultados y maneja errores para evitar corrupción de datos
 */
export async function safeConvertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  try {
    // Validar entrada
    if (!isFinite(amount) || amount < 0) {
      logger.error(`Invalid amount for conversion: ${amount} ${from} -> ${to}`);
      return amount; // Fallback seguro
    }

    // Si es la misma moneda, retornar sin conversión
    if (from === to) {
      return amount;
    }

    // Realizar conversión
    const converted = await convertCurrency(amount, from, to);
    
    // Validar resultado
    if (!isFinite(converted) || converted < 0 || isNaN(converted)) {
      logger.error(
        `Invalid conversion result: ${amount} ${from} -> ${to}, result: ${converted}`
      );
      return amount; // Fallback seguro: retornar cantidad original
    }
    
    // Verificar que la conversión es razonable (no más de 1000x o menos de 0.001x)
    const ratio = converted / amount;
    if (ratio > 1000 || ratio < 0.001) {
      logger.warn(
        `Suspicious conversion ratio: ${ratio} for ${amount} ${from} -> ${to}, result: ${converted}`
      );
      // Aún así retornar el resultado, pero loguear la advertencia
    }
    
    return converted;
  } catch (error) {
    logger.error('Currency conversion failed', error as Error, { amount, from, to });
    // Fallback seguro: retornar cantidad original
    return amount;
  }
}

