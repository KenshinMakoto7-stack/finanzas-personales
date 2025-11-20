/**
 * Servicio de Conversión de Monedas
 * Obtiene el tipo de cambio USD/UYU del Banco Central del Uruguay
 */

interface ExchangeRateCache {
  rate: number;
  date: string; // YYYY-MM-DD
  source: string;
}

let exchangeRateCache: ExchangeRateCache | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene el tipo de cambio USD/UYU
 * Prioridad:
 * 1. Cache (si es del día actual)
 * 2. API pública de tipo de cambio
 * 3. Valor por defecto configurado
 */
export async function getUSDToUYUExchangeRate(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Verificar cache
  if (exchangeRateCache && exchangeRateCache.date === today) {
    return exchangeRateCache.rate;
  }

  // Intentar obtener de API pública
  try {
    // Usar exchangerate-api.com como fuente (gratuita, sin API key para USD/UYU)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      const rate = data.rates?.UYU;
      
      if (rate && typeof rate === 'number' && rate > 0) {
        exchangeRateCache = {
          rate,
          date: today,
          source: 'exchangerate-api'
        };
        return rate;
      }
    }
  } catch (error) {
    console.warn('Error obteniendo tipo de cambio de API:', error);
  }

  // Fallback: Intentar obtener de BCU (scraping o valor por defecto)
  // El BCU publica el tipo de cambio en su sitio web, pero no tiene API pública
  // Por ahora usamos un valor por defecto que puede ser configurado
  const defaultRate = parseFloat(process.env.DEFAULT_USD_UYU_RATE || '40.0');
  
  // Si hay cache de días anteriores, usar ese valor como fallback
  if (exchangeRateCache) {
    console.warn(`Usando tipo de cambio cacheado del ${exchangeRateCache.date}: ${exchangeRateCache.rate}`);
    return exchangeRateCache.rate;
  }

  console.warn(`Usando tipo de cambio por defecto: ${defaultRate} (configurar DEFAULT_USD_UYU_RATE en .env)`);
  exchangeRateCache = {
    rate: defaultRate,
    date: today,
    source: 'default'
  };

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
  console.warn(`Conversión no soportada: ${fromCurrency} -> ${toCurrency}`);
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
    date: exchangeRateCache?.date || new Date().toISOString().slice(0, 10),
    source: exchangeRateCache?.source || 'default'
  };
}

/**
 * Fuerza la actualización del tipo de cambio (limpia cache)
 */
export function clearExchangeRateCache(): void {
  exchangeRateCache = null;
}

