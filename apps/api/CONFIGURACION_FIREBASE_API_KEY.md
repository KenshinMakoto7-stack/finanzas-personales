# 🔑 Configuración de FIREBASE_API_KEY

## ⚠️ IMPORTANTE

El login ahora **verifica la contraseña** usando Firebase Auth REST API. Para que funcione correctamente, necesitas configurar `FIREBASE_API_KEY`.

## 📋 Cómo Obtener la API Key

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** (⚙️) → **General**
4. En la sección **Your apps**, busca **Web API Key**
5. Copia la API Key

## 🔧 Configuración

### Opción 1: Variable de Entorno (Recomendado para Producción)
```bash
# En tu archivo .env o variables de entorno del servidor
FIREBASE_API_KEY=tu-api-key-aqui
```

### Opción 2: Archivo .env.local (Desarrollo Local)
```bash
# Crear archivo apps/api/.env.local
FIREBASE_API_KEY=tu-api-key-aqui
```

## ✅ Verificación

Después de configurar la API Key:

1. Reinicia el servidor API
2. Intenta hacer login con contraseña incorrecta
3. Debe rechazar con "Credenciales inválidas"
4. Intenta con contraseña correcta
5. Debe funcionar correctamente

## ⚠️ Fallback Actual

Si `FIREBASE_API_KEY` no está configurada:
- El servidor mostrará un warning en los logs
- El login funcionará pero **NO verificará la contraseña** (inseguro)
- Esto es solo para desarrollo - **NO usar en producción**

## 🔒 Seguridad

- **NUNCA** commits la API Key al repositorio
- Agrega `.env.local` a `.gitignore`
- Usa variables de entorno en producción
- La API Key es pública (se usa en el frontend), pero aún así debe protegerse

