# 🚀 Setup Automático de Firebase

## ✅ Lo que YA está hecho automáticamente:

1. ✅ Dependencias instaladas (`npm install`)
2. ✅ Archivo `.env` creado con template
3. ✅ Archivo `firebase-service-account.json.example` creado
4. ✅ Código migrado y listo

## ⚠️ Lo que TÚ necesitas hacer (5 minutos):

### Paso 1: Crear Proyecto en Firebase (2 min)

1. Ve a: https://console.firebase.google.com
2. Click en **"Add project"** (o selecciona uno existente)
3. Nombre del proyecto: `finanzas-personales` (o el que prefieras)
4. Click en **"Continue"** → **"Continue"** → **"Create project"**
5. Espera a que termine (30 segundos)

### Paso 2: Habilitar Authentication (1 min)

1. En el menú lateral, click en **"Authentication"**
2. Click en **"Get started"**
3. Ve a la pestaña **"Sign-in method"**
4. Click en **"Email/Password"**
5. Activa el toggle y click en **"Save"**

### Paso 3: Habilitar Firestore (1 min)

1. En el menú lateral, click en **"Firestore Database"**
2. Click en **"Create database"**
3. Selecciona **"Start in production mode"** (configuraremos reglas después)
4. Selecciona ubicación: `us-central1` (o la más cercana)
5. Click en **"Enable"**

### Paso 4: Obtener Credenciales (1 min)

1. Click en el icono de **⚙️ (Settings)** → **"Project settings"**
2. Ve a la pestaña **"Service accounts"**
3. Click en **"Generate new private key"**
4. Se descargará un archivo JSON
5. **Renombra** el archivo a: `firebase-service-account.json`
6. **Mueve** el archivo a: `apps/api/firebase-service-account.json`

### Paso 5: Desplegar Reglas e Índices (opcional, pero recomendado)

**Opción A: Usando Firebase CLI (recomendado)**

```bash
# Instalar Firebase CLI globalmente
npm install -g firebase-tools

# Login
firebase login

# En la carpeta apps/api
cd apps/api

# Inicializar (si no está inicializado)
firebase init firestore
# Selecciona:
# - Use an existing project
# - Selecciona tu proyecto
# - firestore.rules: Y
# - firestore.indexes.json: Y

# Desplegar
firebase deploy --only firestore:rules,firestore:indexes
```

**Opción B: Manualmente desde Firebase Console**

1. Ve a **Firestore Database** → **Rules**
2. Copia el contenido de `firestore.rules`
3. Pega en el editor y click en **"Publish"**
4. Ve a **Firestore Database** → **Indexes**
5. Los índices se crearán automáticamente cuando los necesites (Firebase te dará un link)

## ✅ Verificar que funciona:

```bash
cd apps/api
npm run dev
```

Deberías ver:
```
API escuchando en http://localhost:4000
```

## 🎯 Listo!

Una vez que tengas el archivo `firebase-service-account.json` en `apps/api/`, todo debería funcionar.

## 📝 Notas:

- El archivo `.env` ya está creado y configurado
- El archivo `firebase-service-account.json` NO debe subirse a Git (ya está en .gitignore)
- Si tienes problemas, revisa que el archivo JSON esté en la ruta correcta

