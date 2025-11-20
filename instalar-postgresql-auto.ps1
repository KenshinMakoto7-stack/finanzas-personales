# Script de instalación automática de PostgreSQL
# DEBE EJECUTARSE COMO ADMINISTRADOR

Write-Host "=== INSTALACIÓN AUTOMÁTICA DE POSTGRESQL ===" -ForegroundColor Cyan

$installerPath = "$env:USERPROFILE\Downloads\postgresql-installer.exe"

if (-not (Test-Path $installerPath)) {
    Write-Host "Error: No se encontró el instalador en $installerPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Instalador encontrado: $installerPath" -ForegroundColor Green
Write-Host ""
Write-Host "El instalador se abrirá ahora." -ForegroundColor Yellow
Write-Host "IMPORTANTE: Durante la instalación, configura:" -ForegroundColor Cyan
Write-Host "  - Puerto: 5432" -ForegroundColor White
Write-Host "  - Usuario: postgres" -ForegroundColor White
Write-Host "  - Contraseña: postgres" -ForegroundColor White
Write-Host "  - Base de datos: Deja la predeterminada (postgres)" -ForegroundColor White
Write-Host ""
Write-Host "Presiona cualquier tecla para iniciar la instalación..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Ejecutar el instalador
Start-Process -FilePath $installerPath -Wait

Write-Host ""
Write-Host "=== DESPUÉS DE LA INSTALACIÓN ===" -ForegroundColor Cyan
Write-Host "Esperando 10 segundos para que PostgreSQL se inicie..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Intentar crear la base de datos
Write-Host "Creando base de datos 'pf_db'..." -ForegroundColor Yellow

$env:PGPASSWORD = "postgres"
$createDbCmd = "CREATE DATABASE pf_db;"

try {
    & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -h localhost -c $createDbCmd 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de datos 'pf_db' creada" -ForegroundColor Green
    } else {
        Write-Host "⚠ No se pudo crear automáticamente. Créala manualmente:" -ForegroundColor Yellow
        Write-Host "  psql -U postgres" -ForegroundColor White
        Write-Host "  CREATE DATABASE pf_db;" -ForegroundColor White
    }
} catch {
    Write-Host "⚠ Error al crear base de datos: $_" -ForegroundColor Yellow
    Write-Host "Puedes crearla manualmente después" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== CONFIGURACIÓN COMPLETA ===" -ForegroundColor Green
Write-Host "PostgreSQL debería estar instalado y funcionando." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta: .\configurar-proyecto.ps1" -ForegroundColor Cyan

pause


