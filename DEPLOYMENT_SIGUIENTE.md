# 🎉 ¡Código Subido a GitHub!

## ✅ Estado Actual:
- ✅ Código en GitHub: https://github.com/KenshinMakoto7-stack/finanzas-personales
- ✅ Rama `main` creada y sincronizada
- ✅ Todo listo para deployment

---

## 🚀 SIGUIENTE: Deployment en Railway + Vercel

### PASO 1: Railway (Backend) - 10 minutos

1. **Ir a**: https://railway.app
2. **"Start a New Project"** → **"Login with GitHub"**
3. Autorizar Railway
4. **"New Project"** → **"Deploy from GitHub repo"**
5. **Seleccionar**: `KenshinMakoto7-stack/finanzas-personales`
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

**Nota**: `FRONTEND_URL` y `CORS_ORIGIN` las actualizarás después con la URL de Vercel.

9. **Settings** → **Generate Domain** → **Copiar URL** (ej: `finanzas-api.up.railway.app`)

---

### PASO 2: Vercel (Frontend) - 10 minutos

1. **Ir a**: https://vercel.com
2. **"Sign Up"** → **"Continue with GitHub"**
3. Autorizar Vercel
4. **"Add New..."** → **"Project"**
5. **"Import Git Repository"** → Buscar `finanzas-personales`
6. **Configure Project**:
   - **Root Directory**: Cambiar de `/` a `apps/web`
   - **Framework Preset**: Next.js (automático)
7. **Environment Variables** → **"+ Add"**:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://finanzas-api.up.railway.app
   ```
   (Reemplazar con la URL de Railway del paso 1)
8. **Deploy**
9. Esperar 2-3 minutos
10. **Copiar URL** (ej: `finanzas-personales.vercel.app`)

---

### PASO 3: Actualizar CORS (2 minutos)

1. Volver a Railway
2. Servicio de API → **Variables**
3. Actualizar estas dos:
   ```
   FRONTEND_URL = https://finanzas-personales.vercel.app
   CORS_ORIGIN = https://finanzas-personales.vercel.app
   ```
4. El servicio se reiniciará automáticamente

---

### PASO 4: Migrar Base de Datos (3 minutos)

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

## ✅ Verificación Final

1. Abrir: `https://finanzas-personales.vercel.app`
2. Crear una cuenta
3. Probar crear una transacción
4. Abrir en móvil y verificar que se vea bien
5. Probar instalar como PWA

---

## 📱 Instalación en Móvil

1. Abrir la URL de Vercel en el navegador móvil
2. Aparecerá: **"Agregar a pantalla de inicio"**
3. Click en **"Agregar"**
4. ¡Listo!

---

## 💰 Costo: $0/mes

- Railway: $5 crédito gratis/mes
- Vercel: Gratis para siempre

---

## 🎉 ¡Listo!

Tu app estará disponible en:
- **Web**: `https://finanzas-personales.vercel.app`
- **API**: `https://finanzas-api.up.railway.app`
- **Instalable en móvil** como PWA
- **Accesible desde cualquier dispositivo**

