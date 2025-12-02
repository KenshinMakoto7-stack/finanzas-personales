# Script para hacer push de los fixes de seguridad
Write-Host "=== PUSH DE FIXES DE SEGURIDAD ===" -ForegroundColor Cyan

# Ir al directorio del proyecto
cd C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA

Write-Host "`n1. Verificando estado del repositorio..." -ForegroundColor Yellow
git status

Write-Host "`n2. Agregando cambios..." -ForegroundColor Yellow
git add apps/api/package.json

Write-Host "`n3. Verificando cambios a commitear..." -ForegroundColor Yellow
git diff --cached apps/api/package.json

Write-Host "`n4. Haciendo commit..." -ForegroundColor Yellow
git commit -m "security: Actualizar nodemailer a 7.0.11 y vitest a 2.1.8 para corregir vulnerabilidades"

Write-Host "`n5. Haciendo push a origin/main..." -ForegroundColor Yellow
git push origin main

Write-Host "`n=== COMPLETADO ===" -ForegroundColor Green
Write-Host "Render detectará el cambio y hará redeploy automáticamente." -ForegroundColor Cyan

