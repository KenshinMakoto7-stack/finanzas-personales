# 🚀 Guía Paso a Paso: Configurar SendGrid

## ✅ LO QUE YO PUEDO HACER
- ✅ Preparar el código (ya está listo)
- ✅ Crear esta guía detallada
- ✅ Verificar la configuración después

## 👤 LO QUE TÚ DEBES HACER
- 👤 Crear cuenta en SendGrid (5 minutos)
- 👤 Crear API Key (2 minutos)
- 👤 Verificar email remitente (5 minutos)
- 👤 Agregar variables en Render (3 minutos)

**Total: ~15 minutos**

---

## 📋 PASO 1: Crear Cuenta en SendGrid

### 1.1. Ir a SendGrid
1. Abre: https://sendgrid.com
2. Click en **"Start for free"** o **"Sign Up"**

### 1.2. Completar Registro
1. **Email:** Tu email (el que usarás para administrar SendGrid)
2. **Password:** Crea una contraseña segura
3. **Company Name:** "Finanzas Personales" (o el nombre que quieras)
4. **Website:** Puedes poner tu dominio o dejar en blanco
5. **Use Case:** Selecciona "Transactional Email" o "Marketing Email"
6. **How many emails?:** Selecciona "Less than 100,000" (plan gratuito)
7. Acepta términos y condiciones
8. Click en **"Create Account"**

### 1.3. Verificar Email
1. Revisa tu email
2. Click en el enlace de verificación de SendGrid
3. Completa el proceso de verificación

---

## 📋 PASO 2: Verificar Email Remitente (IMPORTANTE)

**⚠️ ESTO ES NECESARIO para poder enviar emails**

### ⚠️ IMPORTANTE: Si te pregunta sobre DNS

**Si SendGrid te pregunta "Which Domain Name Server (DNS) host do you use?":**
- **Puedes hacer click en "Skip" o "Skip for now"**
- **O simplemente cerrar esa ventana**
- **NO necesitas configurar DNS ahora**

**Usa "Single Sender Verification" en su lugar (más simple y no requiere DNS).**

### Opción A: Verificar un Email Individual (Más Rápido - RECOMENDADO)

1. **Si te aparece la pantalla de DNS:**
   - Click en **"Skip"** o **"Skip for now"**
   - O cierra esa ventana

2. **Ir a Single Sender Verification:**
   - URL directa: https://app.sendgrid.com/settings/sender_auth/senders/new
   - O desde Dashboard: **Settings** → **Sender Authentication** → **Single Sender Verification**

3. Click en **"Create New Sender"**

3. Completa el formulario:
   - **From Email Address:** Tu email (ej: `noreply@tudominio.com` o `tu-email@gmail.com`)
   - **From Name:** "Finanzas Personales"
   - **Reply To:** El mismo email
   - **Company Address:** Tu dirección (requerido)
   - **City:** Tu ciudad
   - **State:** Tu estado/provincia
   - **Country:** Tu país
   - **Zip Code:** Tu código postal

4. Click en **"Create"**

5. **Verificar el email:**
   - SendGrid enviará un email de verificación
   - Revisa tu bandeja de entrada (y spam)
   - Click en el enlace de verificación
   - El estado cambiará a "Verified" ✅

### Opción B: Verificar un Dominio (Más Profesional, pero más complejo)

Si tienes un dominio propio, puedes verificarlo. Esto es opcional y más complejo, así que por ahora usemos la Opción A.

---

## 📋 PASO 3: Crear API Key

### 3.1. Ir a API Keys
1. En SendGrid Dashboard, ve a:
   - **Settings** → **API Keys**
   - O directamente: https://app.sendgrid.com/settings/api_keys

2. Click en **"Create API Key"** (botón verde arriba a la derecha)

### 3.2. Configurar API Key
1. **API Key Name:** "Finanzas App" (o el nombre que quieras)
2. **API Key Permissions:** Selecciona **"Full Access"** (o "Restricted Access" → "Mail Send" si prefieres más seguridad)
3. Click en **"Create & View"**

### 3.3. Copiar API Key
1. **⚠️ IMPORTANTE:** Copia la API Key inmediatamente
2. Se mostrará solo UNA VEZ
3. Empieza con `SG.` seguido de una cadena larga
4. Ejemplo: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Guarda esta API Key en un lugar seguro. La necesitarás en el siguiente paso.**

---

## 📋 PASO 4: Configurar Variables en Render

### 4.1. Ir a Render Dashboard
1. Abre: https://dashboard.render.com
2. Inicia sesión
3. Selecciona tu servicio de backend (API)

### 4.2. Agregar Variables de Entorno
1. En el menú lateral, click en **"Environment"**
2. Click en **"Add Environment Variable"** (o edita las existentes)

### 4.3. Agregar las 3 Variables

**Variable 1:**
- **Key:** `SMTP_HOST`
- **Value:** `sendgrid`
- Click en **"Save Changes"**

**Variable 2:**
- **Key:** `SENDGRID_API_KEY`
- **Value:** `SG.tu-api-key-aqui` (pega la API Key que copiaste en el Paso 3)
- Click en **"Save Changes"**

**Variable 3:**
- **Key:** `SENDGRID_FROM_EMAIL`
- **Value:** El email que verificaste en el Paso 2 (ej: `noreply@tudominio.com` o `tu-email@gmail.com`)
- Click en **"Save Changes"**

### 4.4. Reiniciar Servicio
1. Después de agregar las variables, ve a **"Events"** o **"Manual Deploy"**
2. Click en **"Manual Deploy"** → **"Deploy latest commit"**
3. O simplemente espera a que Render detecte los cambios y reinicie automáticamente

---

## 📋 PASO 5: Verificar que Funciona

### 5.1. Revisar Logs de Render
1. En Render Dashboard, ve a **"Logs"**
2. Busca mensajes como:
   - ✅ `✅ Password reset email sent successfully to [email]`
   - ❌ NO debe aparecer: `⚠️ EMAIL NO ENVIADO`

### 5.2. Probar Recuperación de Contraseña
1. Ve a tu app en producción: `https://tu-app.vercel.app/forgot-password`
2. Ingresa un email válido (que esté registrado en tu app)
3. Click en "Enviar Enlace de Recuperación"
4. Debe aparecer el mensaje de éxito
5. Revisa el email (y la carpeta de spam)
6. Debe llegar el email de recuperación de contraseña

---

## 🐛 TROUBLESHOOTING

### Error: "Email service not configured"
- **Causa:** Las variables de entorno no están configuradas o el servicio no se reinició
- **Solución:** 
  1. Verifica que las 3 variables estén en Render
  2. Reinicia el servicio manualmente

### Error: "Invalid login" o "Authentication failed"
- **Causa:** API Key incorrecta
- **Solución:** 
  1. Verifica que copiaste la API Key completa (empieza con `SG.`)
  2. Verifica que no hay espacios al inicio o final
  3. Crea una nueva API Key si es necesario

### Error: "Sender email not verified"
- **Causa:** El email en `SENDGRID_FROM_EMAIL` no está verificado
- **Solución:** 
  1. Ve a SendGrid → Settings → Sender Authentication
  2. Verifica que el email esté en estado "Verified" ✅
  3. Si no está verificado, verifica el email que recibiste

### El email no llega
- **Causa:** Puede estar en spam o el email no existe
- **Solución:** 
  1. Revisa la carpeta de spam
  2. Verifica que el email esté registrado en tu app
  3. Revisa los logs de Render para ver si hay errores
  4. Revisa el dashboard de SendGrid → Activity para ver el estado del envío

---

## 📊 RESUMEN DE VARIABLES

Después de configurar, en Render deben estar estas 3 variables:

```
SMTP_HOST=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=tu-email-verificado@tudominio.com
```

---

## ✅ CHECKLIST

- [ ] Cuenta creada en SendGrid
- [ ] Email verificado en SendGrid
- [ ] API Key creada y copiada
- [ ] Variable `SMTP_HOST=sendgrid` agregada en Render
- [ ] Variable `SENDGRID_API_KEY` agregada en Render
- [ ] Variable `SENDGRID_FROM_EMAIL` agregada en Render
- [ ] Servicio reiniciado en Render
- [ ] Logs muestran "✅ Password reset email sent successfully"
- [ ] Email de recuperación llega correctamente

---

## 🎯 SIGUIENTE PASO

Una vez que hayas completado todos los pasos, avísame y:
1. Verifico los logs de Render
2. Probamos juntos la recuperación de contraseña
3. Confirmamos que todo funciona correctamente

**¡Vamos paso a paso! Si tienes alguna duda en algún paso, avísame y te ayudo.**

