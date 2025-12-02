# 🔄 Cómo Hacer Redeploy en Render

## ⚠️ IMPORTANTE

**Render NO reinicia automáticamente cuando cambias variables de entorno.**

**Debes hacer un redeploy manual para que los cambios se apliquen.**

---

## 📋 PASOS PARA REDEPLOY

### Opción 1: Manual Deploy (Recomendado)

1. **Ve a Render Dashboard:**
   - https://dashboard.render.com
   - Inicia sesión
   - Selecciona tu servicio (API)

2. **Ir a Manual Deploy:**
   - En el menú lateral, click en **"Manual Deploy"**
   - O ve directamente a la pestaña **"Events"**

3. **Hacer Deploy:**
   - Click en **"Deploy latest commit"**
   - O click en **"Clear build cache & deploy"** (recomendado si quieres asegurarte)

4. **Esperar:**
   - Render comenzará a hacer build
   - Puede tardar 2-5 minutos
   - Verás el progreso en tiempo real

### Opción 2: Desde Events

1. Ve a **"Events"** en el menú lateral
2. Click en **"Manual Deploy"** → **"Deploy latest commit"**

---

## ✅ VERIFICAR QUE FUNCIONA

### Paso 1: Revisar Logs

1. Después del deploy, ve a **"Logs"**
2. Busca mensajes como:
   - ✅ `✅ Password reset email sent successfully to [email]`
   - ❌ NO debe aparecer: `⚠️ EMAIL NO ENVIADO`
   - ❌ NO debe aparecer: `Email service not configured`

### Paso 2: Probar Recuperación de Contraseña

1. Ve a tu app: `https://tu-app.vercel.app/forgot-password`
2. Ingresa un email válido (que esté registrado)
3. Click en "Enviar Enlace de Recuperación"
4. Revisa el email (y carpeta de spam)
5. Debe llegar el email de recuperación

---

## 📊 CHECKLIST ANTES DE REDEPLOY

Asegúrate de tener estas **3 variables** en Render:

- [ ] `SMTP_HOST` = `sendgrid`
- [ ] `SENDGRID_API_KEY` = `SG.tu-api-key-aqui` (pega tu API Key de SendGrid)
- [ ] `SENDGRID_FROM_EMAIL` = El email que verificaste en SendGrid (ej: `tu-email@gmail.com`)

**⚠️ La tercera variable (`SENDGRID_FROM_EMAIL`) es crítica. ¿Ya la configuraste?**

---

## 🐛 SI NO FUNCIONA DESPUÉS DEL REDEPLOY

1. **Verifica las 3 variables** están en Render
2. **Verifica que `SENDGRID_FROM_EMAIL`** sea el email que verificaste en SendGrid
3. **Revisa los logs** para ver errores específicos
4. **Prueba de nuevo** después de unos minutos

---

## 🎯 RESUMEN

1. ✅ Verificar que las 3 variables estén en Render
2. 🔄 Hacer redeploy manual en Render
3. 🔍 Revisar logs
4. 🧪 Probar recuperación de contraseña

