# 📧 Configuración de Email para Producción

## 🔍 PROBLEMA IDENTIFICADO

**Síntoma:** El sistema muestra "Email enviado" pero el email nunca llega.

**Causa:** Las variables de entorno de email no están configuradas en Render.

**Solución:** Configurar un proveedor de email en Render.

---

## ✅ SOLUCIONES DISPONIBLES

### Opción 1: SendGrid (Recomendado - Gratis hasta 100 emails/día)

1. **Crear cuenta en SendGrid:**
   - Ve a: https://sendgrid.com
   - Crea una cuenta gratuita
   - Verifica tu email

2. **Crear API Key:**
   - Ve a Settings → API Keys
   - Click en "Create API Key"
   - Nombre: "Finanzas App"
   - Permisos: "Full Access" o "Mail Send"
   - Copia la API Key (empieza con `SG.`)

3. **Verificar dominio o email remitente:**
   - Ve a Settings → Sender Authentication
   - Verifica un dominio o un email remitente
   - Esto es necesario para enviar emails

4. **Configurar en Render:**
   - Ve a tu servicio en Render Dashboard
   - Environment → Add Environment Variable
   - Agregar:
     ```
     SMTP_HOST=sendgrid
     SENDGRID_API_KEY=SG.tu-api-key-aqui
     SENDGRID_FROM_EMAIL=tu-email-verificado@tudominio.com
     ```
   - **Importante:** `SENDGRID_FROM_EMAIL` debe ser un email verificado en SendGrid

5. **Reiniciar el servicio en Render**

---

### Opción 2: Resend (Alternativa Moderna - 3,000 emails/mes gratis)

1. **Crear cuenta en Resend:**
   - Ve a: https://resend.com
   - Crea una cuenta gratuita
   - Verifica tu email

2. **Crear API Key:**
   - Ve a API Keys
   - Click en "Create API Key"
   - Copia la API Key (empieza con `re_`)

3. **Verificar dominio:**
   - Ve a Domains
   - Agrega y verifica tu dominio
   - O usa el dominio de prueba de Resend

4. **Configurar en Render:**
   - Environment → Add Environment Variable
   - Agregar:
     ```
     SMTP_HOST=resend
     RESEND_API_KEY=re_tu-api-key-aqui
     RESEND_FROM_EMAIL=noreply@tudominio.com
     ```
   - **Importante:** `RESEND_FROM_EMAIL` debe ser un email del dominio verificado

5. **Reiniciar el servicio en Render**

---

### Opción 3: Gmail (Solo para desarrollo - NO recomendado para producción)

1. **Crear App Password en Gmail:**
   - Ve a tu cuenta de Google
   - Security → 2-Step Verification (debe estar activada)
   - App passwords → Generate
   - Copia la contraseña generada

2. **Configurar en Render:**
   - Environment → Add Environment Variable
   - Agregar:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=tu-email@gmail.com
     SMTP_PASS=tu-app-password-aqui
     ```

3. **Reiniciar el servicio en Render**

**⚠️ Limitaciones de Gmail:**
- Límite de 500 emails/día
- Puede ser marcado como spam
- No recomendado para producción

---

## 🔍 VERIFICACIÓN

### Después de configurar:

1. **Revisar logs de Render:**
   - Ve a tu servicio en Render
   - Logs → Buscar mensajes de email
   - Debe aparecer: `✅ Password reset email sent successfully to [email]`
   - NO debe aparecer: `⚠️ Email service not configured`

2. **Probar recuperación de contraseña:**
   - Ir a `/forgot-password` en la app
   - Ingresar un email válido
   - Verificar que llega el email

3. **Si no llega el email:**
   - Revisar logs de Render para ver errores
   - Verificar que el email remitente está verificado en el proveedor
   - Verificar que la API Key es correcta
   - Revisar carpeta de spam

---

## 📋 VARIABLES DE ENTORNO NECESARIAS

### Para SendGrid:
```
SMTP_HOST=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@tudominio.com
```

### Para Resend:
```
SMTP_HOST=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@tudominio.com
```

### Para Gmail/SMTP genérico:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

---

## 🐛 TROUBLESHOOTING

### Error: "Email service not configured"
- **Causa:** No hay variables de entorno configuradas
- **Solución:** Configurar al menos una de las opciones arriba

### Error: "Invalid login" o "Authentication failed"
- **Causa:** API Key incorrecta o email remitente no verificado
- **Solución:** Verificar API Key y email remitente en el proveedor

### Error: "Email not sent" pero no hay error en logs
- **Causa:** El email puede estar en spam o el proveedor lo bloqueó
- **Solución:** Verificar carpeta de spam, verificar dominio en el proveedor

### El email se envía pero no llega
- **Causa:** Problema de entregabilidad del proveedor
- **Solución:** 
  - Verificar que el dominio está verificado
  - Revisar logs del proveedor (SendGrid/Resend dashboard)
  - Verificar que no está en lista negra

---

## 📊 RECOMENDACIÓN FINAL

**Para producción, usa SendGrid o Resend:**
- ✅ SendGrid: 100 emails/día gratis, buena entregabilidad
- ✅ Resend: 3,000 emails/mes gratis, API moderna
- ❌ Gmail: Solo para desarrollo, límites estrictos

**Pasos rápidos:**
1. Crear cuenta en SendGrid o Resend
2. Verificar dominio/email remitente
3. Crear API Key
4. Agregar variables de entorno en Render
5. Reiniciar servicio
6. Probar recuperación de contraseña

---

## 🔗 ENLACES ÚTILES

- SendGrid: https://sendgrid.com
- Resend: https://resend.com
- Render Dashboard: https://dashboard.render.com

