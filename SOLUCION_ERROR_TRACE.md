# Solución: Error "trace parameter is missing"

## ❌ Problema

Al intentar hacer login, aparece el error:
```json
{"error":"trace parameter is missing"}
```

## 🔍 Causa

El error viene de Sentry cuando intenta hacer performance monitoring usando `startInactiveSpan`. Esta función requiere un contexto de trace que puede no estar disponible en ciertos casos.

## ✅ Solución Aplicada

Se deshabilitó temporalmente la función `startTransaction` en `monitoring.ts` para evitar este error. La función ahora retorna un objeto mock que no hace nada.

**Cambios:**
- ✅ `startTransaction` ahora retorna un objeto mock
- ✅ No se intenta crear spans de Sentry que causan el error
- ✅ El código sigue funcionando sin performance monitoring

## 🚀 Próximos Pasos

1. **Redeploy en Render:**
   - Los cambios ya están en GitHub
   - Render debería redeployar automáticamente
   - O haz un "Manual Deploy" en Render

2. **Ejecutar tests nuevamente:**
   ```bash
   npm run test:e2e:ui
   ```

## 📝 Nota

Si necesitas performance monitoring en el futuro, puedes:
- Usar `Sentry.startSpan` directamente en el código donde lo necesites
- O configurar Sentry correctamente con un contexto de trace activo

Por ahora, deshabilitar esta función es la solución más rápida y no afecta la funcionalidad principal.

