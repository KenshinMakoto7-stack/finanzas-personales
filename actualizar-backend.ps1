# Script para actualizar backend en GitHub

Write-Host "=== Estado de Git (Backend) ===" -ForegroundColor Cyan
git status --short
Write-Host ""

Write-Host "=== Ultimos commits locales ===" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""

Write-Host "=== Agregando cambios ===" -ForegroundColor Cyan
git add -A
Write-Host "[OK] Cambios agregados" -ForegroundColor Green
Write-Host ""

Write-Host "=== Estado despues de git add ===" -ForegroundColor Cyan
$status = git status --short
Write-Host $status
Write-Host ""

if ($status -ne "") {
    Write-Host "=== Haciendo commit ===" -ForegroundColor Cyan
    git commit -m "fix: Deshabilitar startTransaction de Sentry para evitar error trace parameter"
    Write-Host "[OK] Commit creado" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "=== Haciendo push a GitHub ===" -ForegroundColor Cyan
    git push origin main
    Write-Host "[OK] Push completado" -ForegroundColor Green
} else {
    Write-Host "[INFO] No hay cambios para commitear" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Verificando commits remotos ===" -ForegroundColor Cyan
git fetch origin
git log --oneline origin/main -3
Write-Host ""

Write-Host "=== PROCESO COMPLETADO ===" -ForegroundColor Green

