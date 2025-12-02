# 🔍 Verificar Configuración de SendGrid en Render

## ⚠️ PROBLEMA ACTUAL

El email falla con timeout de 10 segundos. Esto indica que:
- ✅ El código está funcionando correctamente (timeout funciona)
- ❌ SendGrid SMTP no está conectando desde Render

---

## ✅ VARIABLES NECESARIAS EN RENDER

Ve a **Render Dashboard** → Tu servicio → **Environment** y verifica que tienes estas **3 variables**:

### 1. `SENDGRID_API_KEY`
- **Value:** `SG.tu-api-key-aqui` (tu API Key de SendGrid)
- ✅ **¿Está configurada?**

### 2. `SENDGRID_FROM_EMAIL` ⚠️ **CRÍTICA**
- **Value:** El email que verificaste en SendGrid (ej: `nicolasalejandro.freitas@gmail.com`)
- ⚠️ **¿Está configurada?** (Esta es la más importante)

### 3. `SMTP_HOST` (Opcional pero recomendado)
- **Value:** `sendgrid`
- Esto ayuda al código a detectar que debe usar SendGrid

---

## 🔍 VERIFICACIÓN EN SENDGRID

1. **Ve a SendGrid Dashboard:**
   - https://app.sendgrid.com
   - Inicia sesión

2. **Verificar Single Sender:**
   - Ve a **Settings** → **Sender Authentication**
   - Verifica que el email esté verificado (debe tener un check verde)
   - El email debe ser el mismo que configuraste en `SENDGRID_FROM_EMAIL`

3. **Verificar API Key:**
   - Ve a **Settings** → **API Keys**
   - Verifica que la API Key esté activa
   - Debe empezar con `SG.`

---

## 🐛 SI EL EMAIL SIGUE FALLANDO

### Opción 1: Verificar Variables en Render

1. Ve a Render Dashboard → Tu servicio → **Environment**
2. Verifica que las 3 variables estén configuradas
3. **IMPORTANTE:** `SENDGRID_FROM_EMAIL` debe ser el email verificado en SendGrid
4. Haz un **redeploy manual** después de cambiar variables

### Opción 2: Verificar Logs de SendGrid

1. Ve a SendGrid Dashboard → **Activity**
2. Busca intentos de envío
3. Si hay errores, SendGrid te dirá qué está mal

### Opción 3: Probar con otro email

1. Verifica otro email en SendGrid
2. Actualiza `SENDGRID_FROM_EMAIL` en Render
3. Haz redeploy

---

## 📊 RESUMEN

**Problema:** Email falla con timeout  
**Causa probable:** Variables de entorno no configuradas o email no verificado  
**Solución:** Verificar y configurar las 3 variables en Render  
**Tiempo estimado:** 5 minutos

