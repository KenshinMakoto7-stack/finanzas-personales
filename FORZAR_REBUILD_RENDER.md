# 🔄 Forzar Rebuild Limpio en Render

## ⚠️ PROBLEMA DETECTADO

Render está usando **código compilado cacheado** (viejo). Los cambios no se están aplicando.

**Evidencia:**
- ❌ Request tarda 121 segundos (código viejo)
- ❌ NO aparece log `🔐 Password reset requested for: [email]` (código nuevo)
- ❌ Warning de `trust proxy` persiste (código viejo)

---

## ✅ SOLUCIÓN: Forzar Rebuild Limpio

### Paso 1: Ir a Render Dashboard
1. Ve a: https://dashboard.render.com
2. Inicia sesión
3. Selecciona tu servicio **"finanzas-api"**

### Paso 2: Limpiar Build Cache y Redesplegar
1. En el menú lateral, click en **"Events"**
2. Click en **"Manual Deploy"** (botón en la parte superior)
3. **IMPORTANTE:** Selecciona **"Clear build cache & deploy"**
   - Esto fuerza un rebuild completo sin usar cache
4. Espera 2-5 minutos mientras Render:
   - Limpia el cache
   - Reinstala dependencias
   - Recompila el código TypeScript
   - Redespliega

### Paso 3: Verificar Logs Después del Deploy
1. Ve a **"Logs"** en Render Dashboard
2. Busca estos mensajes de inicio:
   - ✅ `API escuchando en http://localhost:10000`
   - ✅ NO debe aparecer el warning de `trust proxy` (o debe aparecer menos)
3. Prueba recuperación de contraseña
4. En los logs, DEBE aparecer:
   - ✅ `🔐 Password reset requested for: [email]`
   - ✅ La request debe responder en < 1 segundo

---

## 🔍 VERIFICACIÓN ADICIONAL

Si después del rebuild limpio sigue el problema:

### Verificar que el Build se Ejecutó Correctamente
1. En Render Dashboard → **"Events"**
2. Busca el último deploy
3. Verifica que el build paso mostró:
   - ✅ `npm install` completado
   - ✅ `npm run build` completado
   - ✅ `tsc` (TypeScript compiler) ejecutado sin errores

### Verificar Código Compilado
Si tienes acceso SSH a Render (no disponible en plan free), puedes verificar:
```bash
# Verificar que el código compilado tiene los cambios
cat dist/controllers/auth.controller.js | grep "Password reset requested"
# Debe mostrar: logger.info(`🔐 Password reset requested for: ${email}`);
```

---

## 📊 RESUMEN

**Problema:** Render usando código compilado cacheado  
**Solución:** Clear build cache & deploy  
**Tiempo estimado:** 2-5 minutos  
**Verificación:** Logs deben mostrar `🔐 Password reset requested for: [email]`

