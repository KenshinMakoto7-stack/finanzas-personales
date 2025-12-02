# Solución: Error de CORS en Tests

## ❌ Problema

Los tests están fallando con este error:
```
Access to XMLHttpRequest at 'https://finanzas-api-homa.onrender.com/auth/login' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

## 🔍 Causa

El backend en Render tiene configurado `CORS_ORIGIN` que solo permite ciertos orígenes. Cuando el frontend en `localhost:3000` intenta conectarse al backend en producción, el backend bloquea la petición porque `http://localhost:3000` no está en la lista de orígenes permitidos.

## ✅ Solución

### Opción 1: Agregar localhost a CORS_ORIGIN en Render (RECOMENDADO)

1. Ve a Render Dashboard: https://dashboard.render.com
2. Selecciona tu servicio de backend (`finanzas-api-homa`)
3. Ve a **Environment** (Variables de Entorno)
4. Busca la variable `CORS_ORIGIN`
5. Agrega `http://localhost:3000` a la lista (separado por comas)

**Formato actual:**
```
CORS_ORIGIN=https://finanzas-web-sepia.vercel.app
```

**Formato corregido:**
```
CORS_ORIGIN=https://finanzas-web-sepia.vercel.app,http://localhost:3000
```

6. Guarda los cambios
7. Render redeployará automáticamente

### Opción 2: Modificar el código del backend (Alternativa)

Si prefieres no modificar las variables de entorno en Render, puedes modificar el código para siempre permitir localhost en desarrollo:

```typescript
// En apps/api/src/server/app.ts
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

// Agregar localhost siempre (para tests)
if (process.env.NODE_ENV !== 'production' || !process.env.CORS_ORIGIN) {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
}
```

Pero esto requiere hacer deploy del backend.

## 🎯 Recomendación

**Usa la Opción 1** porque:
- ✅ No requiere cambios en el código
- ✅ Se aplica inmediatamente
- ✅ No afecta la seguridad en producción (solo permite localhost para tests)

## 🔍 Verificación

Después de actualizar `CORS_ORIGIN` en Render:

1. Espera 1-2 minutos a que Render redeploye
2. Ejecuta los tests nuevamente:
   ```bash
   npm run test:e2e:ui
   ```
3. El error de CORS debería desaparecer

## 📝 Nota de Seguridad

Agregar `http://localhost:3000` a `CORS_ORIGIN` es seguro porque:
- Solo permite conexiones desde localhost (tu máquina)
- No permite conexiones desde otros orígenes
- Es necesario para ejecutar tests localmente

