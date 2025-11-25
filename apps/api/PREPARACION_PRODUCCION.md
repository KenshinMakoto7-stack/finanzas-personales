# 🚀 PREPARACIÓN PARA PRODUCCIÓN

**Fecha:** $(date)  
**Estado:** Listo para ejecutar

---

## ✅ Checklist Pre-Producción

### 1. Configurar FIREBASE_API_KEY

**⚠️ CRÍTICO:** Sin esto, el login NO verificará contraseñas.

#### Pasos:
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** (⚙️) → **General**
4. En la sección **Your apps**, busca **Web API Key**
5. Copia la API Key

#### Configuración:

**Opción A: Variable de Entorno (Recomendado para Producción)**
```bash
# En tu servidor de producción, agregar:
export FIREBASE_API_KEY=tu-api-key-aqui
```

**Opción B: Archivo .env.local (Desarrollo)**
```bash
# Crear archivo apps/api/.env.local
FIREBASE_API_KEY=tu-api-key-aqui
```

**Opción C: Variables de Entorno del Sistema (Windows)**
```powershell
# PowerShell
[System.Environment]::SetEnvironmentVariable('FIREBASE_API_KEY', 'tu-api-key-aqui', 'User')
```

#### Verificación:
```bash
# Reiniciar servidor y verificar logs
# Debe mostrar: "Login verification using Firebase Auth REST API"
# NO debe mostrar: "⚠️ FIREBASE_API_KEY not set"
```

---

### 2. Desplegar Reglas de Firestore

**✅ Firebase CLI instalado:** v14.15.1

#### Pasos:
```bash
cd apps/api

# 1. Iniciar sesión en Firebase (si no lo has hecho)
firebase login

# 2. Seleccionar proyecto (si tienes múltiples)
firebase use --add
# Selecciona tu proyecto de la lista

# 3. Desplegar reglas
firebase deploy --only firestore:rules
```

#### Verificación:
- Debe mostrar: "✔ Deploy complete!"
- En Firebase Console → Firestore Database → Rules, deben aparecer las nuevas reglas

---

### 3. Crear Índices de Firestore

**⚠️ IMPORTANTE:** Los índices pueden tardar varios minutos en crearse.

#### Pasos:
```bash
cd apps/api

# Desplegar índices
firebase deploy --only firestore:indexes
```

#### Verificación:
- Debe mostrar: "✔ Deploy complete!"
- En Firebase Console → Firestore Database → Indexes, deben aparecer los índices
- **Nota:** Los índices pueden estar en estado "Building" por varios minutos

#### Índices que se crearán:
- `transactions`: userId + occurredAt (desc)
- `transactions`: userId + categoryId + occurredAt (desc)
- `transactions`: userId + accountId + occurredAt (desc)
- `transactions`: userId + isRecurring + occurredAt (desc)
- `categories`: userId + parentId
- `monthlyGoals`: userId + month
- `categoryBudgets`: userId + month
- `categoryBudgets`: userId + categoryId + month
- `debts`: userId + startMonth
- `transactionPatterns`: userId + categoryId

---

## 🔧 Script Automatizado

Puedes ejecutar este script para hacer todo de una vez:

```powershell
# Script: deploy-firestore.ps1
cd apps/api

Write-Host "🔐 Verificando autenticación..." -ForegroundColor Yellow
firebase login --no-localhost

Write-Host "📋 Desplegando reglas de Firestore..." -ForegroundColor Yellow
firebase deploy --only firestore:rules

Write-Host "📊 Desplegando índices de Firestore..." -ForegroundColor Yellow
firebase deploy --only firestore:indexes

Write-Host "✅ Despliegue completado!" -ForegroundColor Green
Write-Host "⚠️  Recuerda configurar FIREBASE_API_KEY en variables de entorno" -ForegroundColor Yellow
```

---

## ⚠️ Notas Importantes

1. **FIREBASE_API_KEY es pública** (se usa en frontend), pero aún así debe protegerse
2. **NUNCA** commits la API Key al repositorio
3. Agrega `.env.local` a `.gitignore` si no está
4. Las reglas de Firestore se validan en el cliente también, pero el backend debe validar también (defensa en profundidad)
5. Los índices pueden tardar varios minutos en crearse - no te preocupes si ves "Building"

---

## ✅ Verificación Final

Después de completar estos pasos:

1. ✅ Login rechaza contraseñas incorrectas
2. ✅ Reglas de Firestore desplegadas
3. ✅ Índices de Firestore creados (o en proceso)
4. ✅ Servidor inicia sin errores
5. ✅ Queries funcionan correctamente

---

## 🆘 Troubleshooting

### Error: "Firebase project not found"
```bash
firebase use --add
# Selecciona tu proyecto
```

### Error: "Permission denied"
```bash
firebase login
# Inicia sesión con tu cuenta de Google
```

### Error: "Index already exists"
- Esto es normal, significa que el índice ya existe
- Puedes ignorarlo o eliminarlo manualmente en Firebase Console

### Error: "Rules deployment failed"
- Verifica la sintaxis de `firestore.rules`
- Usa `firebase deploy --only firestore:rules --debug` para más detalles

