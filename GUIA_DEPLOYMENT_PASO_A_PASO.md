# 🚀 Guía Paso a Paso - Deployment GRATUITO

## ✅ Opción Recomendada: Vercel + Railway (100% Gratis)

**Costo**: $0/mes (Railway da $5 gratis, suficiente para empezar)

---

## 📋 Paso 1: Preparar Iconos PWA

### Opción A: Convertir SVG a PNG Online (5 minutos)
1. Ir a: https://cloudconvert.com/svg-to-png
2. Subir `apps/web/public/icons/icon-192x192.svg`
3. Configurar tamaño: 192x192
4. Descargar como `icon-192x192.png`
5. Repetir para `icon-512x512.svg` (512x512)
6. Guardar ambos PNG en `apps/web/public/icons/`

### Opción B: Usar el Generador HTML (2 minutos)
1. Abrir `apps/web/public/icons/generate-icons.html` en el navegador
2. Click en "Generar y Descargar Iconos"
3. Los PNG se descargarán automáticamente
4. Moverlos a `apps/web/public/icons/`

**Verificar que existan**:
- ✅ `apps/web/public/icons/icon-192x192.png`
- ✅ `apps/web/public/icons/icon-512x512.png`

---

## 📋 Paso 2: Preparar Repositorio GitHub

```bash
# Ir a la carpeta del proyecto
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"

# Verificar .gitignore
# Asegurar que tiene:
# .env
# .env.local
# .env.production
# node_modules

# Si no tienes git inicializado:
git init
git add .
git commit -m "Initial commit"

# Crear repositorio en GitHub y conectar:
git remote add origin https://github.com/tu-usuario/tu-repo.git
git branch -M main
git push -u origin main
```

---

## 📋 Paso 3: Deploy Backend en Railway (GRATIS)

### 3.1. Crear Cuenta
1. Ir a: https://railway.app
2. Click en **"Start a New Project"**
3. **"Login with GitHub"**
4. Autorizar Railway

### 3.2. Crear Proyecto
1. **"New Project"**
2. **"Deploy from GitHub repo"**
3. Seleccionar tu repositorio
4. Click en **"Deploy Now"**

### 3.3. Configurar Backend
1. Click en el servicio que se creó
2. **Settings** → **Root Directory**: `apps/api`
3. **Settings** → **Build Command**: `npm install && npm run build`
4. **Settings** → **Start Command**: `npm start`

### 3.4. Agregar PostgreSQL
1. Click en **"+ New"**
2. **"Database"** → **"Add PostgreSQL"**
3. Se creará automáticamente

### 3.5. Variables de Entorno
1. Click en el servicio de API
2. **Variables** tab
3. Agregar estas variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=tu-secreto-super-seguro-minimo-32-caracteres
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

### 3.6. Obtener URL del Backend
1. Click en el servicio de API
2. **Settings** → **Generate Domain**
3. Copiar la URL (ej: `tu-api.up.railway.app`)

### 3.7. Migrar Base de Datos
1. En Railway, click en PostgreSQL
2. **Connect** → **PostgreSQL URL**
3. Copiar la URL completa
4. En tu PC local:
   ```bash
   cd apps/api
   # Reemplazar con tu URL de Railway
   $env:DATABASE_URL="postgresql://..." 
   npx prisma migrate deploy
   ```

---

## 📋 Paso 4: Deploy Frontend en Vercel (GRATIS)

### 4.1. Crear Cuenta
1. Ir a: https://vercel.com
2. **"Sign Up"** → **"Continue with GitHub"**
3. Autorizar Vercel

### 4.2. Importar Proyecto
1. **"Add New..."** → **"Project"**
2. **"Import Git Repository"**
3. Seleccionar tu repositorio
4. Click en **"Import"**

### 4.3. Configurar Proyecto
1. **Framework Preset**: Next.js (automático)
2. **Root Directory**: `apps/web` (cambiar de `/` a `apps/web`)
3. **Build Command**: `npm run build` (automático)
4. **Output Directory**: `.next` (automático)

### 4.4. Variables de Entorno
1. En la sección **"Environment Variables"**
2. Agregar:
   ```
   NEXT_PUBLIC_API_URL=https://tu-api.up.railway.app
   ```
   (Reemplazar con la URL de Railway del paso 3.6)

### 4.5. Deploy
1. Click en **"Deploy"**
2. Esperar a que termine (2-3 minutos)
3. Copiar la URL (ej: `tu-proyecto.vercel.app`)

### 4.6. Actualizar CORS en Railway
1. Volver a Railway
2. En las variables de entorno del backend:
3. Actualizar:
   ```
   FRONTEND_URL=https://tu-proyecto.vercel.app
   CORS_ORIGIN=https://tu-proyecto.vercel.app
   ```
4. El servicio se reiniciará automáticamente

---

## 📋 Paso 5: Verificar que Funciona

1. Abrir: `https://tu-proyecto.vercel.app`
2. Crear una cuenta
3. Probar crear una transacción
4. Verificar que todo funciona

---

## 📱 Instalación en Móvil

1. Abrir `https://tu-proyecto.vercel.app` en el navegador móvil
2. Aparecerá banner: **"Agregar a pantalla de inicio"**
3. Click en **"Agregar"**
4. ¡Listo! La app está instalada como PWA

---

## 🔧 Troubleshooting

### Error: CORS
- Verificar que `CORS_ORIGIN` en Railway tenga la URL correcta de Vercel
- Verificar que no tenga `/` al final

### Error: Database connection
- Verificar que `DATABASE_URL` en Railway esté correcta
- Verificar que las migraciones se hayan ejecutado

### Error: Build failed
- Revisar logs en Vercel
- Verificar que `Root Directory` sea `apps/web`
- Verificar que todas las dependencias estén en `package.json`

---

## 💰 Costos

- **Vercel**: $0/mes (gratis para siempre)
- **Railway**: $0/mes (con $5 de crédito gratis, suficiente para empezar)
- **Total**: **$0/mes**

Si creces mucho, Railway puede costar ~$5-10/mes, pero Vercel sigue gratis.

---

## ✅ Checklist Final

- [ ] Iconos PNG creados (192x192 y 512x512)
- [ ] Repositorio en GitHub
- [ ] Backend deployado en Railway
- [ ] PostgreSQL configurado en Railway
- [ ] Variables de entorno configuradas en Railway
- [ ] Base de datos migrada
- [ ] Frontend deployado en Vercel
- [ ] Variables de entorno configuradas en Vercel
- [ ] CORS actualizado con URL de Vercel
- [ ] App funcionando en producción
- [ ] Probada en móvil

---

## 🎉 ¡Listo!

Tu app está disponible en:
- **Web**: `https://tu-proyecto.vercel.app`
- **API**: `https://tu-api.up.railway.app`
- **Instalable en móvil** como PWA
- **Costo**: $0/mes

