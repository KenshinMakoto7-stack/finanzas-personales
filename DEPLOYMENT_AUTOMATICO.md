# 🚀 Deployment Automático - Railway + Vercel

## ✅ Estado Actual

- ✅ Código optimizado para móviles
- ✅ CORS configurado
- ✅ Scripts de build listos
- ⚠️ Iconos PNG: Necesitan convertirse (2 minutos)

## 📋 Pasos para Deployment

### 1. Convertir Iconos (2 minutos)
**Opción Rápida:**
1. Ir a: https://cloudconvert.com/svg-to-png
2. Subir `apps/web/public/icons/icon-192x192.svg` → Convertir → Descargar
3. Subir `apps/web/public/icons/icon-512x512.svg` → Convertir → Descargar
4. Guardar ambos PNG en `apps/web/public/icons/`

### 2. Subir a GitHub
```bash
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"
git add .
git commit -m "Preparado para deployment - Optimizado para móviles"
# Crear repo en GitHub y:
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### 3. Railway (Backend) - SIN TARJETA
1. https://railway.app → Login con GitHub
2. New Project → Deploy from GitHub
3. Configurar:
   - Root: `apps/api`
   - Build: `npm install && npm run build`
   - Start: `npm start`
4. Agregar PostgreSQL
5. Variables de entorno (ver abajo)
6. Copiar URL del backend

### 4. Vercel (Frontend) - GRATIS
1. https://vercel.com → Login con GitHub
2. Import Project
3. Configurar:
   - Root: `apps/web`
   - Variable: `NEXT_PUBLIC_API_URL` = URL de Railway
4. Deploy

### 5. Actualizar CORS
En Railway, actualizar `CORS_ORIGIN` con URL de Vercel

### 6. Migrar BD
```bash
cd apps/api
DATABASE_URL="url-de-railway" npx prisma migrate deploy
```

## 🔑 Variables de Entorno

### Railway (Backend):
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
SMTP_PASS=tu-app-password
```

### Vercel (Frontend):
```
NEXT_PUBLIC_API_URL=https://tu-api.railway.app
```

## 💰 Costo: $0/mes

- Railway: $5 crédito gratis/mes
- Vercel: Gratis para siempre

