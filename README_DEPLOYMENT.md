# 🚀 Deployment - Finanzas Personales

## ✅ Optimizaciones Completadas

- ✅ **Optimizado para móviles**: Responsive design, tamaños táctiles, viewport configurado
- ✅ **PWA configurado**: Manifest.json, Service Worker, meta tags
- ✅ **CORS configurado**: Listo para producción
- ✅ **Scripts de build**: Configurados para Railway y Vercel

## ⚠️ Pendiente: Iconos PNG

Los iconos SVG están creados, pero necesitan convertirse a PNG:
- `apps/web/public/icons/icon-192x192.svg` → `icon-192x192.png`
- `apps/web/public/icons/icon-512x512.svg` → `icon-512x512.png`

**Método rápido (2 minutos):**
1. Ir a: https://cloudconvert.com/svg-to-png
2. Subir cada SVG y convertir
3. Guardar los PNG en `apps/web/public/icons/`

## 🚀 Deployment en Railway + Vercel (SIN TARJETA)

### Paso 1: Subir a GitHub

```bash
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"
git add .
git commit -m "Preparado para deployment"
# Crear repo en GitHub y:
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### Paso 2: Railway (Backend) - GRATIS

1. **Ir a**: https://railway.app
2. **Login** con GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Seleccionar tu repositorio
5. **Settings** del servicio:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
6. **Agregar PostgreSQL**:
   - Click **+ New** → **Database** → **Add PostgreSQL**
7. **Variables de Entorno**:
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
8. **Obtener URL**: Settings → Generate Domain → Copiar URL

### Paso 3: Vercel (Frontend) - GRATIS

1. **Ir a**: https://vercel.com
2. **Login** con GitHub
3. **Add New Project** → **Import Git Repository**
4. Seleccionar tu repositorio
5. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` (cambiar de `/` a `apps/web`)
   - **Build Command**: `npm run build` (automático)
   - **Output Directory**: `.next` (automático)
6. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://tu-api.up.railway.app
   ```
   (Reemplazar con la URL de Railway del paso 2)
7. **Deploy**
8. **Copiar URL**: `https://tu-proyecto.vercel.app`

### Paso 4: Actualizar CORS

1. Volver a Railway
2. En las **Variables de Entorno** del backend:
3. Actualizar:
   ```
   FRONTEND_URL=https://tu-proyecto.vercel.app
   CORS_ORIGIN=https://tu-proyecto.vercel.app
   ```
4. El servicio se reiniciará automáticamente

### Paso 5: Migrar Base de Datos

1. En Railway, click en PostgreSQL
2. **Connect** → **PostgreSQL URL**
3. Copiar la URL completa
4. En tu PC local:
   ```bash
   cd apps/api
   # Reemplazar con tu URL de Railway
   $env:DATABASE_URL="postgresql://usuario:password@host:puerto/database"
   npx prisma migrate deploy
   ```

## ✅ Verificación

1. Abrir: `https://tu-proyecto.vercel.app`
2. Crear una cuenta
3. Probar crear una transacción
4. Verificar en móvil que se vea bien

## 📱 Instalación en Móvil

1. Abrir `https://tu-proyecto.vercel.app` en el navegador móvil
2. Aparecerá banner: **"Agregar a pantalla de inicio"**
3. Click en **"Agregar"**
4. ¡Listo! La app está instalada como PWA

## 💰 Costo

- **Railway**: $0/mes (con $5 de crédito gratis, suficiente para empezar)
- **Vercel**: $0/mes (gratis para siempre)
- **Total**: **$0/mes**

## 🔧 Troubleshooting

### Error: CORS
- Verificar que `CORS_ORIGIN` en Railway tenga la URL correcta de Vercel
- Verificar que no tenga `/` al final

### Error: Database connection
- Verificar que `DATABASE_URL` en Railway esté correcta
- Verificar que las migraciones se hayan ejecutado

### Error: Build failed
- Revisar logs en Vercel/Railway
- Verificar que `Root Directory` sea correcto
- Verificar que todas las dependencias estén en `package.json`

## 🎉 Resultado Final

Después del deployment:
- ✅ App disponible en: `https://tu-proyecto.vercel.app`
- ✅ API disponible en: `https://tu-api.up.railway.app`
- ✅ Instalable en móvil como PWA
- ✅ Funciona offline
- ✅ Accesible desde cualquier dispositivo
- ✅ **Costo: $0/mes**

