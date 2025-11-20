# 🚀 DEPLOYMENT - Sigue estos pasos AHORA

## ✅ Lo que YA está hecho:

- ✅ Iconos PNG creados (192x192 y 512x512)
- ✅ Código optimizado para móviles
- ✅ CORS configurado
- ✅ Scripts de build listos
- ✅ Archivos de configuración creados (railway.json, vercel.json)
- ✅ Todo commiteado en Git

---

## 📋 PASOS PARA DEPLOYMENT (30 minutos)

### PASO 1: Subir a GitHub (5 min)

```bash
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"

# Si no tienes repo en GitHub, créalo primero:
# 1. Ve a https://github.com/new
# 2. Crea un repositorio (ej: "finanzas-personales")
# 3. NO inicialices con README

# Luego ejecuta:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

**Reemplaza `TU-USUARIO` y `TU-REPO` con tus datos reales.**

---

### PASO 2: Railway - Backend (10 min)

1. **Ir a**: https://railway.app
2. **"Start a New Project"** → **"Login with GitHub"**
3. Autorizar Railway
4. **"New Project"** → **"Deploy from GitHub repo"**
5. Seleccionar tu repositorio
6. Click en el servicio creado → **Settings**:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
7. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
8. Click en el servicio de API → **Variables** → **"+ New Variable"**:

```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
JWT_SECRET = tu-secreto-super-seguro-minimo-32-caracteres-aqui
NODE_ENV = production
PORT = 4000
FRONTEND_URL = https://tu-app.vercel.app
CORS_ORIGIN = https://tu-app.vercel.app
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = tu-email@gmail.com
SMTP_PASS = tu-app-password-de-gmail
```

**Nota**: `FRONTEND_URL` y `CORS_ORIGIN` las actualizarás después.

9. **Settings** → **Generate Domain** → **Copiar URL** (ej: `tu-api.up.railway.app`)

---

### PASO 3: Vercel - Frontend (10 min)

1. **Ir a**: https://vercel.com
2. **"Sign Up"** → **"Continue with GitHub"**
3. Autorizar Vercel
4. **"Add New..."** → **"Project"**
5. **"Import Git Repository"** → Seleccionar tu repositorio
6. **Configure Project**:
   - **Root Directory**: Cambiar de `/` a `apps/web`
   - **Framework Preset**: Next.js (automático)
7. **Environment Variables** → **"+ Add"**:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://tu-api.up.railway.app
   ```
   (Reemplazar con la URL de Railway del paso 2)
8. **Deploy**
9. Esperar 2-3 minutos
10. **Copiar URL** (ej: `tu-proyecto.vercel.app`)

---

### PASO 4: Actualizar CORS (2 min)

1. Volver a Railway
2. Servicio de API → **Variables**
3. Actualizar estas dos:
   ```
   FRONTEND_URL = https://tu-proyecto.vercel.app
   CORS_ORIGIN = https://tu-proyecto.vercel.app
   ```
4. El servicio se reiniciará automáticamente

---

### PASO 5: Migrar Base de Datos (3 min)

1. En Railway → PostgreSQL → **Connect** → **PostgreSQL URL**
2. **Copiar la URL completa**

3. En tu PC:
   ```powershell
   cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA\apps\api"
   $env:DATABASE_URL="postgresql://usuario:password@host:puerto/database"
   npx prisma migrate deploy
   ```

**Reemplaza la URL con la real de Railway.**

---

## ✅ Verificación

1. Abrir: `https://tu-proyecto.vercel.app`
2. Crear una cuenta
3. Probar crear una transacción
4. Abrir en móvil y verificar que se vea bien
5. Probar instalar como PWA

---

## 📱 Instalación en Móvil

1. Abrir `https://tu-proyecto.vercel.app` en el navegador móvil
2. Aparecerá: **"Agregar a pantalla de inicio"**
3. Click en **"Agregar"**
4. ¡Listo!

---

## 💰 Costo: $0/mes

- Railway: $5 crédito gratis/mes
- Vercel: Gratis para siempre

---

## 🆘 Si algo falla

1. Revisar logs en Railway/Vercel
2. Verificar variables de entorno
3. Verificar que las URLs no tengan `/` al final
4. Ver `DEPLOYMENT_COMPLETO.md` para más detalles

---

## 🎉 ¡Listo!

Tu app estará disponible en:
- **Web**: `https://tu-proyecto.vercel.app`
- **API**: `https://tu-api.up.railway.app`
- **Instalable en móvil** como PWA
- **Accesible desde cualquier dispositivo**

