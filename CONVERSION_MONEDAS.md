# Sistema de Conversión de Monedas

## Implementación

Se ha implementado un sistema completo de conversión de monedas que permite convertir automáticamente todas las transacciones en USD a UYU (o viceversa) para poder comparar y mostrar estadísticas consistentes.

## Características

### 1. Servicio de Tipo de Cambio (`exchange.service.ts`)

- **Fuente Principal**: API pública de exchangerate-api.com (gratuita, sin API key)
- **Fallback**: Valor configurable en variable de entorno `DEFAULT_USD_UYU_RATE` (default: 40.0)
- **Cache**: El tipo de cambio se cachea por 24 horas para evitar llamadas excesivas
- **Actualización**: Endpoint para forzar actualización del tipo de cambio

### 2. Endpoints de API

- `GET /exchange/rate`: Obtiene el tipo de cambio actual USD/UYU
- `POST /exchange/refresh`: Fuerza la actualización del tipo de cambio (requiere autenticación)

### 3. Conversión Automática

Todas las estadísticas y cálculos ahora convierten automáticamente:
- **Gastos por categoría**: Convierte USD a UYU antes de agrupar
- **Estadísticas de ingresos**: Convierte USD a UYU antes de calcular
- **Estadísticas de ahorro**: Convierte USD a UYU antes de calcular
- **Dashboard**: Convierte todas las transacciones a la moneda base del usuario
- **Gráficos históricos**: Convierte todas las transacciones para comparaciones consistentes

### 4. Moneda Base

- La moneda base se determina por `user.currencyCode` (default: "UYU")
- Todas las comparaciones y estadísticas se muestran en la moneda base
- Las transacciones originales mantienen su moneda original en la base de datos

## Configuración

### Variable de Entorno

Agregar al archivo `.env` del API:

```env
# Tipo de cambio por defecto USD/UYU (si falla la API)
DEFAULT_USD_UYU_RATE=40.0
```

### Uso del Tipo de Cambio

El sistema intenta obtener el tipo de cambio actualizado diariamente de:
1. **API pública** (exchangerate-api.com) - Actualizado automáticamente
2. **Cache** - Si ya se obtuvo hoy, usa el valor cacheado
3. **Valor por defecto** - Si falla todo, usa el valor configurado

## Ejemplo de Uso

```typescript
// Obtener tipo de cambio
const rate = await getUSDToUYUExchangeRate();

// Convertir monto
const amountInUYU = await convertCurrency(10000, "USD", "UYU");
// Si rate = 40, entonces amountInUYU = 400000 (centavos)
```

## Notas Importantes

1. **Precisión**: Los montos se redondean a centavos enteros (sin decimales)
2. **Cache**: El tipo de cambio se actualiza automáticamente cada 24 horas
3. **Fallback**: Si la API falla, se usa el valor por defecto configurado
4. **Monedas Soportadas**: Actualmente solo USD ↔ UYU
5. **Transacciones Originales**: Las transacciones mantienen su moneda original en la BD

## Mejoras Futuras

- [ ] Integración directa con API del BCU (cuando esté disponible)
- [ ] Soporte para más monedas
- [ ] Historial de tipos de cambio
- [ ] Conversión usando el tipo de cambio del día de la transacción (no el actual)

