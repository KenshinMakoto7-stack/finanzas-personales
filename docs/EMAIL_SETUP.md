# Configuración de Email para Recuperación de Contraseña

Este documento explica cómo configurar el servicio de email para que los usuarios puedan recuperar sus contraseñas.

## Opciones de Proveedores

### Opción 1: Gmail (Desarrollo/Pruebas)

1. Activa "Acceso de apps menos seguras" o crea una "Contraseña de aplicación"
2. Configura las variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

⚠️ **Nota**: Gmail tiene límites de envío (500/día). No recomendado para producción.

### Opción 2: SendGrid (Recomendado para Producción)

1. Crea una cuenta en [SendGrid](https://sendgrid.com)
2. Genera una API Key en Settings > API Keys
3. Configura:

```env
SMTP_HOST=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
```

**Ventajas**: 100 emails/día gratis, buena entregabilidad.

### Opción 3: Resend (Alternativa Moderna)

1. Crea una cuenta en [Resend](https://resend.com)
2. Genera una API Key
3. Configura:

```env
SMTP_HOST=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
```

**Ventajas**: 3,000 emails/mes gratis, API moderna.

### Opción 4: SMTP Genérico

Para cualquier otro proveedor SMTP:

```env
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=contraseña
```

## Configuración en Render.com

1. Ve a tu servicio en Render Dashboard
2. Environment > Add Environment Variable
3. Agrega las variables según el proveedor elegido

## Verificar Configuración

Sin configuración de email, los enlaces de recuperación se muestran en los logs:

```
[INFO] Password reset requested for user@example.com. Reset URL: https://...
```

Con configuración correcta:

```
[INFO] Password reset email sent to user@example.com
```

## Flujo de Recuperación

1. Usuario hace clic en "Olvidé mi contraseña"
2. Ingresa su email
3. Backend genera link con Firebase Auth (`generatePasswordResetLink`)
4. Email se envía con el link
5. Usuario hace clic y Firebase maneja el reset

## Troubleshooting

### Email no llega

1. Revisa logs en Render para errores
2. Verifica que las credenciales son correctas
3. Revisa carpeta de spam
4. Verifica que el dominio del remitente está configurado (SPF/DKIM)

### Error de autenticación SMTP

```
Error: Invalid login: 535 Authentication failed
```

- Gmail: Usa contraseña de aplicación, no la normal
- SendGrid: Verifica que la API key tiene permisos de Mail Send

### Rate limiting

Si ves errores de límite:
- Gmail: Máximo 500/día
- SendGrid Free: 100/día
- Resend Free: 100/día, 3000/mes

## Variables de Entorno Completas

```env
# Opción Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx

# Opción SendGrid
SMTP_HOST=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxx

# Opción Resend
SMTP_HOST=resend
RESEND_API_KEY=re_xxxxxxxxxx
```

