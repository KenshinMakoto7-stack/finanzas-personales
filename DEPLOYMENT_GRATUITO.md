# 🚀 Guía de Deployment GRATUITO - Finanzas Personales

## ✅ Opciones 100% Gratuitas

### **Opción 1: Vercel (Frontend) + Supabase (Backend + BD) - RECOMENDADO**

**Costo**: $0/mes (completamente gratis)

#### Frontend - Vercel
- ✅ Hosting gratuito ilimitado
- ✅ SSL/HTTPS automático
- ✅ Deploy automático desde GitHub
- ✅ CDN global
- ✅ Build automático

#### Backend + Base de Datos - Supabase
- ✅ PostgreSQL gratuito (500MB)
- ✅ API REST automática
- ✅ Autenticación incluida
- ⚠️ Necesitas adaptar el código para usar Supabase en vez de tu API actual

**Alternativa más fácil**: Usar tu API actual en Railway (tier gratis)

---

### **Opción 2: Vercel (Frontend) + Railway (Backend) - MÁS FÁCIL**

**Costo**: $0/mes (Railway da $5 gratis al mes, suficiente para empezar)

#### Frontend - Vercel
- ✅ Gratis
- ✅ Deploy automático

#### Backend - Railway
- ✅ $5 de crédito gratis al mes
- ✅ PostgreSQL incluido
- ✅ Deploy desde GitHub
- ✅ SSL automático

**Esta es la opción más fácil y no requiere cambiar código**

---

### **Opción 3: Netlify (Frontend) + Render (Backend)**

**Costo**: $0/mes

#### Frontend - Netlify
- ✅ Hosting gratuito
- ✅ SSL automático
- ✅ Deploy desde GitHub

#### Backend - Render
- ✅ Tier gratis (se duerme después de 15 min de inactividad)
- ✅ PostgreSQL gratis
- ✅ Se despierta automáticamente cuando hay tráfico

---

## 🎯 Recomendación: Vercel + Railway

**Razones**:
1. ✅ Ambos son gratuitos para empezar
2. ✅ No requiere cambiar código
3. ✅ Deploy automático desde GitHub
4. ✅ SSL/HTTPS automático
5. ✅ Fácil de configurar

---

## 📋 Pasos para Deployment Gratuito

### **Paso 1: Preparar Repositorio GitHub**

```bash
# Asegurar que .env está en .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore

# Commit y push
git add .
git commit -m "Preparar para deployment"
git push
```

### **Paso 2: Deploy Backend en Railway (GRATIS)**

1. **Ir a**: https://railway.app
2. **Crear cuenta** (con GitHub)
3. **New Project** → **Deploy from GitHub repo**
4. **Seleccionar tu repositorio**
5. **Configurar**:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (o `node dist/index.js` si usas build)
6. **Agregar PostgreSQL**:
   - Click en **+ New** → **Database** → **PostgreSQL**
7. **Variables de Entorno**:
   - Click en el servicio de API → **Variables**
   - Agregar:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     JWT_SECRET=tu-secreto-super-seguro-aqui
     NODE_ENV=production
     PORT=4000
     FRONTEND_URL=https://tu-app.vercel.app
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=tu-email@gmail.com
     SMTP_PASS=tu-app-password
     ```
8. **Obtener URL del backend**:
   - Click en el servicio → **Settings** → **Generate Domain**
   - Copiar la URL (ej: `tu-api.railway.app`)

### **Paso 3: Deploy Frontend en Vercel (GRATIS)**

1. **Ir a**: https://vercel.com
2. **Crear cuenta** (con GitHub)
3. **Add New Project** → **Import Git Repository**
4. **Seleccionar tu repositorio**
5. **Configurar**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build` (automático)
   - **Output Directory**: `.next` (automático)
6. **Variables de Entorno**:
   ```
   NEXT_PUBLIC_API_URL=https://tu-api.railway.app
   ```
7. **Deploy**
8. **Obtener URL**: `https://tu-proyecto.vercel.app`

### **Paso 4: Actualizar CORS en Backend**

En Railway, agregar variable de entorno:
```
CORS_ORIGIN=https://tu-proyecto.vercel.app
```

Y actualizar el código del backend para usar esta variable.

### **Paso 5: Migrar Base de Datos**

En Railway:
1. Abrir PostgreSQL service
2. Click en **Connect** → **PostgreSQL URL**
3. Copiar la URL
4. En tu PC local:
   ```bash
   cd apps/api
   DATABASE_URL="url-de-railway" npx prisma migrate deploy
   ```

---

## 🔧 Configuración Adicional

### **Actualizar CORS en Backend**

```typescript
// apps/api/src/server/app.ts
const allowedOrigins = process.env.CORS_ORIGIN 
  ? [process.env.CORS_ORIGIN]
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

### **Scripts de Build**

Asegurar que `apps/api/package.json` tenga:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## 📱 Acceso desde Móvil

Una vez deployado:
1. Abrir `https://tu-proyecto.vercel.app` en el móvil
2. Aparecerá opción "Agregar a pantalla de inicio"
3. ¡Listo! La app está instalada

---

## 💰 Costos

### **Opción Vercel + Railway**:
- **Vercel**: $0/mes (gratis para siempre)
- **Railway**: $0/mes (con $5 de crédito gratis, suficiente para empezar)
- **Total**: **$0/mes**

### **Si creces** (muchos usuarios):
- Railway: ~$5-10/mes
- Vercel: Sigue gratis

---

## ✅ Checklist Pre-Deployment

- [ ] Repositorio en GitHub
- [ ] .env en .gitignore
- [ ] Iconos PWA creados
- [ ] Manifest.json actualizado
- [ ] Variables de entorno preparadas
- [ ] CORS configurado
- [ ] Build funciona localmente

---

## 🚀 Comandos Rápidos

```bash
# Probar build localmente
cd apps/api && npm run build
cd apps/web && npm run build

# Verificar que funciona
cd apps/api && npm start
cd apps/web && npm start
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisar logs en Railway/Vercel
2. Verificar variables de entorno
3. Verificar que CORS esté configurado
4. Verificar que la BD esté migrada

---

## 🎉 Resultado Final

Después del deployment:
- ✅ App disponible en: `https://tu-proyecto.vercel.app`
- ✅ API disponible en: `https://tu-api.railway.app`
- ✅ Instalable en móvil como PWA
- ✅ Funciona offline
- ✅ **Costo: $0/mes**

