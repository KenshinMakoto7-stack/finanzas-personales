# 🔥 Configuración de Firebase

## Paso 1: Crear Proyecto en Firebase

1. Ir a: https://console.firebase.google.com
2. Click en **"Add project"** o seleccionar proyecto existente
3. Seguir los pasos para crear el proyecto

## Paso 2: Habilitar Authentication

1. En Firebase Console, ir a **"Authentication"**
2. Click en **"Get started"**
3. Ir a la pestaña **"Sign-in method"**
4. Habilitar **"Email/Password"**
5. Click en **"Email/Password"** → Habilitar → Guardar

## Paso 3: Habilitar Firestore Database

1. En Firebase Console, ir a **"Firestore Database"**
2. Click en **"Create database"**
3. Seleccionar **"Start in production mode"** (las reglas se configurarán después)
4. Seleccionar ubicación (ej: `us-central1`)
5. Click en **"Enable"**

## Paso 4: Obtener Credenciales de Servicio

1. En Firebase Console, ir a **"Project Settings"** (icono de engranaje)
2. Ir a la pestaña **"Service accounts"**
3. Click en **"Generate new private key"**
4. Se descargará un archivo JSON
5. **Renombrar** el archivo a `firebase-service-account.json`
6. **Mover** a `apps/api/` (o configurar la ruta en `.env`)

## Paso 5: Configurar Variables de Entorno

Crear archivo `.env` en `apps/api/`:

```env
# Opción 1: Usar archivo JSON
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Opción 2: Usar JSON string (para producción)
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

PORT=4000
NODE_ENV=production
FRONTEND_URL=https://tu-app.vercel.app
CORS_ORIGIN=https://tu-app.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password-de-gmail
```

## Paso 6: Desplegar Reglas de Firestore

1. Instalar Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login:
   ```bash
   firebase login
   ```

3. Inicializar proyecto (si no está inicializado):
   ```bash
   cd apps/api
   firebase init firestore
   ```

4. Desplegar reglas:
   ```bash
   firebase deploy --only firestore:rules
   ```

5. Desplegar índices:
   ```bash
   firebase deploy --only firestore:indexes
   ```

## Paso 7: Crear Índices en Firebase Console

Si algunos queries fallan, Firebase te dará un link para crear los índices automáticamente. O puedes crearlos manualmente:

1. Ir a **"Firestore Database"** → **"Indexes"**
2. Click en **"Create index"**
3. Seguir los índices definidos en `firestore.indexes.json`

## ✅ Verificación

1. Instalar dependencias:
   ```bash
   cd apps/api
   npm install
   ```

2. Probar localmente:
   ```bash
   npm run dev
   ```

3. Probar endpoint:
   ```bash
   curl http://localhost:4000/
   ```

## 📝 Notas Importantes

- **Seguridad**: Nunca subas `firebase-service-account.json` a Git
- **Reglas**: Las reglas en `firestore.rules` deben desplegarse antes de usar la app
- **Índices**: Algunos queries complejos requieren índices compuestos
- **Límites**: El plan Spark (gratis) tiene límites de lecturas/escrituras

## 🚀 Deployment

Para producción, puedes:
1. Usar Firebase Functions (recomendado)
2. Usar cualquier hosting (Render, Railway, etc.) con las credenciales

