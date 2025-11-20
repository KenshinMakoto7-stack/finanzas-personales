# ⚡ Inicio Rápido - Deployment

## 🎯 Objetivo: Tener la app funcionando en producción en 30 minutos

---

## ✅ Checklist Pre-Deployment

- [ ] Iconos PNG creados (192x192 y 512x512)
- [ ] Código subido a GitHub
- [ ] Cuenta Railway creada
- [ ] Cuenta Vercel creada

---

## 🚀 Deployment en 5 Pasos

### 1️⃣ Crear Iconos (2 min)
```bash
cd apps/web/public/icons
node create-png-icons.js
```
Si falla, abre `generate-icons.html` en el navegador.

### 2️⃣ Subir a GitHub (5 min)
```bash
cd "C:\Users\Gamer\Desktop\PROYECTO APP FINANZA"
git add .
git commit -m "Listo para deployment"
# Crear repo en GitHub y:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### 3️⃣ Railway - Backend (10 min)
1. https://railway.app → Login GitHub
2. New Project → Deploy from GitHub
3. Root: `apps/api`
4. Agregar PostgreSQL
5. Variables (ver abajo)
6. Copiar URL

### 4️⃣ Vercel - Frontend (10 min)
1. https://vercel.com → Login GitHub
2. Import Project
3. Root: `apps/web`
4. Variable: `NEXT_PUBLIC_API_URL` = URL Railway
5. Deploy
6. Copiar URL

### 5️⃣ Actualizar CORS (2 min)
En Railway, actualizar:
- `FRONTEND_URL` = URL de Vercel
- `CORS_ORIGIN` = URL de Vercel

---

## 🔑 Variables de Entorno

### Railway:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=tu-secreto-32-caracteres-minimo
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://tu-app.vercel.app
CORS_ORIGIN=https://tu-app.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

### Vercel:
```
NEXT_PUBLIC_API_URL=https://tu-api.railway.app
```

---

## 📱 Resultado

- App: `https://tu-app.vercel.app`
- API: `https://tu-api.railway.app`
- Instalable en móvil
- **Costo: $0/mes**

---

## 📖 Guía Completa

Ver `DEPLOYMENT_COMPLETO.md` para instrucciones detalladas.

