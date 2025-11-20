# Script para verificar que todos los servicios estén funcionando

Write-Host "=== VERIFICANDO SERVICIOS ===" -ForegroundColor Cyan
Write-Host ""

# Verificar API
Write-Host "1. Verificando API (puerto 4000)..." -ForegroundColor Yellow
try {
    $apiHealth = Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing -TimeoutSec 5
    if ($apiHealth.StatusCode -eq 200) {
        Write-Host "   ✓ API funcionando correctamente" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ API no responde: $_" -ForegroundColor Red
    Write-Host "   Ejecuta: cd apps\api && npm run dev" -ForegroundColor Yellow
}

# Verificar Web
Write-Host ""
Write-Host "2. Verificando Web (puerto 3000)..." -ForegroundColor Yellow
try {
    $webHealth = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    if ($webHealth.StatusCode -eq 200) {
        Write-Host "   ✓ Web funcionando correctamente" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Web no responde: $_" -ForegroundColor Red
    Write-Host "   Ejecuta: cd apps\web && npm run dev" -ForegroundColor Yellow
}

# Verificar PostgreSQL
Write-Host ""
Write-Host "3. Verificando PostgreSQL..." -ForegroundColor Yellow
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"
$env:PGPASSWORD = "postgres"
try {
    $pgTest = & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -h localhost -d pf_db -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ PostgreSQL funcionando correctamente" -ForegroundColor Green
    } else {
        Write-Host "   ✗ PostgreSQL no responde" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ PostgreSQL no encontrado" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== RESUMEN ===" -ForegroundColor Cyan
Write-Host "Si todos los servicios están funcionando, puedes:" -ForegroundColor White
Write-Host "1. Abrir http://localhost:3000 en tu navegador" -ForegroundColor Cyan
Write-Host "2. Iniciar sesión con:" -ForegroundColor Cyan
Write-Host "   Email: ana@example.com" -ForegroundColor White
Write-Host "   Contraseña: Secreta123" -ForegroundColor White

pause


