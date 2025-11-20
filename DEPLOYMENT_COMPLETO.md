# 🚀 Deployment Completo - Guía Automatizada

## ✅ Estado: Listo para Deployment

He preparado todo el código y configuración. Ahora solo necesitas seguir estos pasos:

---

## 📋 Paso 1: Crear Iconos PNG (2 minutos)

**Opción A - Automática (Recomendada):**
```bash
cd apps/web/public/icons
node create-png-icons.js
```

**Opción B - Manual:**
1. Abre `apps/web/public/icons/generate-icons.html` en el navegador
2. Click en "Generar y Descargar Iconos"
3. Mueve los PNG descargados a `apps/web/public/icons/`

**Verificar:**
- ✅ `icon-192x192.png` existe
- ✅ `icon-512x512.png` existe

---

## 📋 Paso 2: Subir a GitHub

```bash
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"

# Si es la primera vez:
git init
git add .
git commit -m "Optimizado para móviles - Listo para deployment"

# Crear repositorio en GitHub (https://github.com/new)
# Luego:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

---

## 📋 Paso 3: Railway (Backend) - SIN TARJETA

### 3.1. Crear Proyecto
1. **Ir a**: https://railway.app
2. **"Start a New Project"** → **"Login with GitHub"**
3. Autorizar Railway
4. **"New Project"** → **"Deploy from GitHub repo"**
5. Seleccionar tu repositorio
6. Click en **"Deploy Now"**

### 3.2. Configurar Servicio
1. Click en el servicio creado
2. **Settings** → Configurar:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### 3.3. Agregar PostgreSQL
1. Click en **"+ New"**
2. **"Database"** → **"Add PostgreSQL"**
3. Se creará automáticamente

### 3.4. Variables de Entorno
1. Click en el servicio de API
2. **Variables** tab
3. Click **"+ New Variable"** y agregar cada una:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=tu-secreto-super-seguro-minimo-32-caracteres-aqui
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://tu-app.vercel.app
CORS_ORIGIN=https://tu-app.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password-de-gmail
```

**Nota**: `FRONTEND_URL` y `CORS_ORIGIN` las actualizarás después con la URL de Vercel.

### 3.5. Obtener URL del Backend
1. Click en el servicio de API
2. **Settings** → **Generate Domain**
3. **Copiar la URL** (ej: `tu-api.up.railway.app`)

---

## 📋 Paso 4: Vercel (Frontend) - GRATIS

### 4.1. Crear Proyecto
1. **Ir a**: https://vercel.com
2. **"Sign Up"** → **"Continue with GitHub"**
3. Autorizar Vercel

### 4.2. Importar Proyecto
1. **"Add New..."** → **"Project"**
2. **"Import Git Repository"**
3. Seleccionar tu repositorio
4. Click en **"Import"**

### 4.3. Configurar Proyecto
1. **Framework Preset**: Next.js (automático)
2. **Root Directory**: Cambiar de `/` a `apps/web`
3. **Build Command**: `npm run build` (automático)
4. **Output Directory**: `.next` (automático)

### 4.4. Variables de Entorno
1. En la sección **"Environment Variables"**
2. Click **"+ Add"**
3. Agregar:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://tu-api.up.railway.app
   ```
   (Reemplazar con la URL de Railway del paso 3.5)

### 4.5. Deploy
1. Click en **"Deploy"**
2. Esperar 2-3 minutos
3. **Copiar la URL** (ej: `tu-proyecto.vercel.app`)

---

## 📋 Paso 5: Actualizar CORS en Railway

1. Volver a Railway
2. En el servicio de API → **Variables**
3. Actualizar estas dos variables:
   ```
   FRONTEND_URL=https://tu-proyecto.vercel.app
   CORS_ORIGIN=https://tu-proyecto.vercel.app
   ```
4. El servicio se reiniciará automáticamente

---

## 📋 Paso 6: Migrar Base de Datos

1. En Railway, click en PostgreSQL
2. **Connect** → **PostgreSQL URL**
3. **Copiar la URL completa**

4. En tu PC local:
   ```bash
   cd apps/api
   # Windows PowerShell:
   $env:DATABASE_URL="postgresql://usuario:password@host:puerto/database"
   npx prisma migrate deploy
   
   # O Windows CMD:
   set DATABASE_URL=postgresql://usuario:password@host:puerto/database
   npx prisma migrate deploy
   ```

---

## ✅ Verificación Final

1. Abrir: `https://tu-proyecto.vercel.app`
2. Crear una cuenta
3. Probar crear una transacción
4. Verificar en móvil que se vea bien
5. Probar instalar como PWA en móvil

---

## 📱 Instalación en Móvil

1. Abrir `https://tu-proyecto.vercel.app` en el navegador móvil
2. Aparecerá banner: **"Agregar a pantalla de inicio"**
3. Click en **"Agregar"**
4. ¡Listo! La app está instalada como PWA

---

## 💰 Costo

- **Railway**: $0/mes (con $5 de crédito gratis, suficiente para empezar)
- **Vercel**: $0/mes (gratis para siempre)
- **Total**: **$0/mes**

---

## 🔧 Troubleshooting

### Error: CORS
- Verificar que `CORS_ORIGIN` en Railway tenga la URL correcta de Vercel
- Verificar que no tenga `/` al final
- Verificar que ambas URLs usen `https://`

### Error: Database connection
- Verificar que `DATABASE_URL` en Railway esté correcta
- Verificar que las migraciones se hayan ejecutado
- Verificar que PostgreSQL esté activo en Railway

### Error: Build failed
- Revisar logs en Vercel/Railway
- Verificar que `Root Directory` sea correcto
- Verificar que todas las dependencias estén en `package.json`

### Error: 404 en iconos
- Verificar que los PNG existan en `apps/web/public/icons/`
- Verificar que el manifest.json tenga las rutas correctas

---

## 🎉 ¡Listo!

Después de completar estos pasos:
- ✅ App disponible en: `https://tu-proyecto.vercel.app`
- ✅ API disponible en: `https://tu-api.up.railway.app`
- ✅ Instalable en móvil como PWA
- ✅ Funciona offline
- ✅ Accesible desde cualquier dispositivo
- ✅ **Costo: $0/mes**

