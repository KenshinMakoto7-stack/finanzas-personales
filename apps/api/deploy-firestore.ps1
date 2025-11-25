# Script para desplegar reglas e índices de Firestore
# Ejecutar desde: apps/api/

Write-Host "🚀 Despliegue de Firestore - Preparación para Producción" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "firebase.json")) {
    Write-Host "❌ Error: firebase.json no encontrado. Ejecuta este script desde apps/api/" -ForegroundColor Red
    exit 1
}

# Verificar que Firebase CLI está instalado
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Firebase CLI no está instalado" -ForegroundColor Red
    Write-Host "Instala con: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Firebase CLI encontrado" -ForegroundColor Green
Write-Host ""

# Verificar autenticación
Write-Host "🔐 Verificando autenticación..." -ForegroundColor Yellow
$authCheck = firebase projects:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No autenticado. Iniciando login..." -ForegroundColor Yellow
    firebase login --no-localhost
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error al autenticarse" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Autenticación verificada" -ForegroundColor Green
Write-Host ""

# Desplegar reglas
Write-Host "📋 Desplegando reglas de Firestore..." -ForegroundColor Yellow
firebase deploy --only firestore:rules
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al desplegar reglas" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Reglas desplegadas exitosamente" -ForegroundColor Green
Write-Host ""

# Desplegar índices
Write-Host "📊 Desplegando índices de Firestore..." -ForegroundColor Yellow
Write-Host "⚠️  Nota: Los índices pueden tardar varios minutos en crearse" -ForegroundColor Yellow
firebase deploy --only firestore:indexes
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al desplegar índices" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Índices desplegados exitosamente" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 Despliegue completado!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  RECORDATORIO IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   Configura FIREBASE_API_KEY en variables de entorno" -ForegroundColor Yellow
Write-Host "   Ver: PREPARACION_PRODUCCION.md para más detalles" -ForegroundColor Yellow
Write-Host ""

