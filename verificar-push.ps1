# Script para verificar y hacer push de cambios
Write-Host "=== Verificando estado de Git ===" -ForegroundColor Cyan

# Verificar estado
Write-Host "`n1. Estado del repositorio:" -ForegroundColor Yellow
git status

# Ver commits locales
Write-Host "`n2. Últimos 3 commits locales:" -ForegroundColor Yellow
git log --format="%h - %s (%an, %ar)" -3

# Ver commits remotos
Write-Host "`n3. Últimos 3 commits remotos:" -ForegroundColor Yellow
git log origin/main --format="%h - %s (%an, %ar)" -3

# Verificar si hay diferencias
Write-Host "`n4. Comparando local vs remoto:" -ForegroundColor Yellow
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main

if ($localCommit -eq $remoteCommit) {
    Write-Host "✓ Local y remoto están sincronizados" -ForegroundColor Green
} else {
    Write-Host "⚠ Hay diferencias entre local y remoto" -ForegroundColor Yellow
    Write-Host "   Local:  $localCommit" -ForegroundColor Gray
    Write-Host "   Remoto: $remoteCommit" -ForegroundColor Gray
    
    Write-Host "`n5. Haciendo push..." -ForegroundColor Yellow
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Push exitoso" -ForegroundColor Green
    } else {
        Write-Host "✗ Error en el push" -ForegroundColor Red
    }
}

Write-Host "`n=== Proceso completado ===" -ForegroundColor Cyan

