# 🔍 Diagnóstico: Recuperación de Contraseña se queda colgada

## 📊 ANÁLISIS DE LA CAPTURA

**Observaciones:**
- ✅ Preflight (OPTIONS) pasó correctamente (status 204)
- ❌ Solicitud POST a `/auth/forgot-password` está `(pending)`
- ⏳ La solicitud no responde después de varios minutos

**Esto indica:**
- CORS está funcionando correctamente
- El problema está en el backend (no responde)

---

## 🔍 POSIBLES CAUSAS

### 1. Firebase `generatePasswordResetLink` está tardando
- **Causa:** Firebase puede tardar mucho si hay problemas de red o configuración
- **Solución:** Agregar timeout de 15 segundos

### 2. Error no manejado en el backend
- **Causa:** Un error puede estar bloqueando la respuesta
- **Solución:** Mejorar manejo de errores y logging

### 3. El email service está bloqueando
- **Causa:** `sendPasswordResetEmail` puede estar esperando indefinidamente
- **Solución:** Hacer el envío de email no bloqueante

---

## ✅ CORRECCIONES APLICADAS

### Backend (`auth.controller.ts`):
1. ✅ **Timeout de 15 segundos** para `generatePasswordResetLink`
2. ✅ **Envío de email no bloqueante** (no espera a que termine)
3. ✅ **Mejor manejo de errores** con logging
4. ✅ **Respuesta inmediata** al frontend (no espera el email)

### Frontend (`forgot-password/page.tsx`):
1. ✅ **Mejor manejo de errores** de timeout y conexión
2. ✅ **Mensajes de error más claros**
3. ✅ **Logging en consola** para debug

---

## 🔍 VERIFICACIÓN NECESARIA

### En Render (Backend):
1. **Revisar logs:**
   - Ve a Render Dashboard → Tu servicio → Logs
   - Buscar mensajes relacionados con "Password reset"
   - Ver si hay errores de Firebase

2. **Verificar variables de entorno:**
   - `FIREBASE_SERVICE_ACCOUNT` o `FIREBASE_SERVICE_ACCOUNT_PATH` debe estar configurada
   - `CORS_ORIGIN` debe incluir la URL de Vercel

### En Vercel (Frontend):
1. **Verificar variable:**
   - `NEXT_PUBLIC_API_URL` = `https://finanzas-api-homa.onrender.com` ✅ (ya verificado)

---

## 🚀 PRÓXIMOS PASOS

1. **Hacer commit y push** (ya aplicado)
2. **Esperar deploy en Render** (1-2 minutos)
3. **Probar recuperación de contraseña nuevamente:**
   - Debe responder en menos de 15 segundos
   - Si hay error, debe mostrar mensaje claro
   - Si funciona, debe mostrar mensaje de éxito

---

## 🐛 SI SIGUE COLGADA DESPUÉS DEL DEPLOY

### Verificar en Render Logs:
1. Ir a Render Dashboard → Logs
2. Intentar recuperación de contraseña
3. Buscar en logs:
   - `Password reset requested for: [email]`
   - `Password reset link generated for: [email]`
   - Cualquier error relacionado

### Verificar Firebase:
1. Ir a Firebase Console → Authentication
2. Verificar que el email existe
3. Verificar que Firebase Auth esté habilitado

### Verificar CORS:
1. En Render, verificar variable `CORS_ORIGIN`
2. Debe incluir la URL de Vercel (ej: `https://finanzas-web-sepia.vercel.app`)

---

## 📊 RESUMEN

**Problema:** Solicitud POST se queda colgada  
**Causa probable:** Firebase `generatePasswordResetLink` tarda mucho o falla  
**Solución aplicada:**
- ✅ Timeout de 15 segundos
- ✅ Envío de email no bloqueante
- ✅ Mejor manejo de errores
- ✅ Respuesta inmediata al frontend

**Acción requerida:**
- 🔄 Deploy en Render (automático después del push)
- 🧪 Probar nuevamente después del deploy

