# 🔧 Solución: Botón "Enviando..." se queda colgado

## 🔍 PROBLEMA IDENTIFICADO

El botón de registro se queda en "Enviando..." por más de 2 minutos sin respuesta.

**Posibles causas:**
1. ⚠️ **Timeout no configurado** - La solicitud puede quedarse esperando indefinidamente
2. ⚠️ **URL de API incorrecta** - La app puede estar intentando conectar a `localhost:4000` en producción
3. ⚠️ **Backend no responde** - El servidor puede estar caído o lento
4. ⚠️ **Error no capturado** - El error puede no estar mostrándose correctamente

---

## ✅ CORRECCIONES APLICADAS

### 1. Timeout agregado a Axios
- ✅ Agregado timeout de **30 segundos** en `lib/api.ts`
- ✅ Si la solicitud tarda más de 30 segundos, mostrará error de timeout

### 2. Manejo de errores mejorado
- ✅ Mejor captura de errores de timeout
- ✅ Mejor captura de errores de conexión
- ✅ Mensajes de error más claros para el usuario

### 3. Logging mejorado
- ✅ Agregado `console.error` para debug
- ✅ Mejor información de errores en consola

---

## 🔍 VERIFICACIÓN NECESARIA

### Paso 1: Verificar URL de API en Producción

**En Vercel Dashboard:**
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que existe: `NEXT_PUBLIC_API_URL`
4. Verifica que el valor es la URL de tu backend en Render (ej: `https://tu-api.onrender.com`)

**Si NO existe:**
- Agregar variable: `NEXT_PUBLIC_API_URL`
- Valor: URL de tu backend en Render
- Reiniciar deploy en Vercel

### Paso 2: Verificar que el Backend esté funcionando

**En Render Dashboard:**
1. Ve a tu servicio de API
2. Verifica que esté "Live" (no "Suspended")
3. Revisa los logs para ver si hay errores
4. Prueba acceder directamente a: `https://tu-api.onrender.com/health` (si existe)

---

## 🐛 TROUBLESHOOTING

### Si el botón sigue colgado después de 30 segundos:

1. **Abrir consola del navegador (F12)**
2. **Ir a la pestaña "Network"**
3. **Intentar registro nuevamente**
4. **Verificar:**
   - ¿Se hace la solicitud POST a `/auth/register`?
   - ¿Qué URL está usando? (debe ser la de Render, NO localhost)
   - ¿Qué status code devuelve? (200, 400, 500, timeout?)
   - ¿Hay algún error en la consola?

### Si la URL es `localhost:4000`:

**Problema:** La variable `NEXT_PUBLIC_API_URL` no está configurada en Vercel.

**Solución:**
1. Ve a Vercel Dashboard → Tu proyecto → Settings → Environment Variables
2. Agregar: `NEXT_PUBLIC_API_URL` = `https://tu-api.onrender.com`
3. Hacer redeploy en Vercel

### Si la URL es correcta pero sigue sin responder:

**Problema:** El backend puede estar caído o muy lento.

**Solución:**
1. Verificar logs de Render
2. Verificar que el servicio esté "Live"
3. Probar acceder directamente a la API desde el navegador

---

## 📋 CHECKLIST DE VERIFICACIÓN

- [ ] Variable `NEXT_PUBLIC_API_URL` configurada en Vercel
- [ ] Valor de `NEXT_PUBLIC_API_URL` es la URL de Render (NO localhost)
- [ ] Backend en Render está "Live"
- [ ] No hay errores en logs de Render
- [ ] Timeout de 30 segundos configurado (ya aplicado)
- [ ] Manejo de errores mejorado (ya aplicado)

---

## 🚀 PRÓXIMOS PASOS

1. **Hacer commit y push de los cambios:**
   ```bash
   cd C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA
   git add apps/web/lib/api.ts apps/web/app/signup/page.tsx apps/web/store/auth.ts
   git commit -m "fix: Agregar timeout y mejorar manejo de errores en registro"
   git push origin main
   ```

2. **Verificar variable de entorno en Vercel:**
   - Asegurarse de que `NEXT_PUBLIC_API_URL` esté configurada
   - Valor debe ser la URL de Render

3. **Esperar deploy en Vercel** (automático, 1-2 minutos)

4. **Probar registro nuevamente:**
   - Debe mostrar error después de 30 segundos si hay problema
   - O debe funcionar correctamente si el backend responde

---

## 📊 RESUMEN

**Cambios aplicados:**
- ✅ Timeout de 30 segundos agregado
- ✅ Manejo de errores mejorado
- ✅ Logging mejorado

**Verificación requerida:**
- ⚠️ Variable `NEXT_PUBLIC_API_URL` en Vercel
- ⚠️ Backend funcionando en Render

**Acción:**
- 🔄 Hacer commit y push
- 🔄 Verificar variables de entorno en Vercel
- 🧪 Probar registro nuevamente

