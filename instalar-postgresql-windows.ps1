# Script para instalar PostgreSQL directamente en Windows (sin Docker)
# Alternativa cuando Docker no está disponible

Write-Host "=== INSTALACIÓN DE POSTGRESQL EN WINDOWS ===" -ForegroundColor Cyan
Write-Host "Esta es una alternativa a Docker que no requiere virtualización" -ForegroundColor Yellow
Write-Host ""

# Verificar si PostgreSQL ya está instalado
$pgPath = Get-Command psql -ErrorAction SilentlyContinue
if ($pgPath) {
    Write-Host "✓ PostgreSQL parece estar instalado" -ForegroundColor Green
    Write-Host "Ubicación: $($pgPath.Source)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Para continuar, necesitas:" -ForegroundColor Yellow
    Write-Host "1. Crear una base de datos llamada 'pf_db'" -ForegroundColor White
    Write-Host "2. Usuario: postgres, Contraseña: postgres" -ForegroundColor White
    Write-Host ""
    Write-Host "¿Deseas que te guíe para configurarlo? (S/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "S" -or $response -eq "s") {
        Write-Host "Ejecutando configuración..." -ForegroundColor Cyan
        # Continuar con la configuración
    } else {
        exit 0
    }
} else {
    Write-Host "PostgreSQL no está instalado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPCIÓN 1: Instalación automática con Chocolatey (recomendado)" -ForegroundColor Cyan
    Write-Host "Si tienes Chocolatey instalado, ejecuta:" -ForegroundColor White
    Write-Host "  choco install postgresql -y" -ForegroundColor Green
    Write-Host ""
    Write-Host "OPCIÓN 2: Descarga manual" -ForegroundColor Cyan
    Write-Host "1. Ve a: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Descarga el instalador" -ForegroundColor White
    Write-Host "3. Durante la instalación, configura:" -ForegroundColor White
    Write-Host "   - Puerto: 5432" -ForegroundColor White
    Write-Host "   - Usuario: postgres" -ForegroundColor White
    Write-Host "   - Contraseña: postgres" -ForegroundColor White
    Write-Host ""
    
    # Intentar instalar con Chocolatey si está disponible
    $choco = Get-Command choco -ErrorAction SilentlyContinue
    if ($choco) {
        Write-Host "Chocolatey detectado. ¿Instalar PostgreSQL ahora? (S/N)" -ForegroundColor Yellow
        $install = Read-Host
        if ($install -eq "S" -or $install -eq "s") {
            Write-Host "Instalando PostgreSQL..." -ForegroundColor Cyan
            choco install postgresql -y
        }
    } else {
        Write-Host "Chocolatey no está instalado." -ForegroundColor Yellow
        Write-Host "Puedes instalarlo desde: https://chocolatey.org/install" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "=== DESPUÉS DE INSTALAR POSTGRESQL ===" -ForegroundColor Cyan
Write-Host "Actualiza el archivo .env en apps\api con:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pf_db?schema=public" -ForegroundColor Green
Write-Host ""
Write-Host "Luego ejecuta:" -ForegroundColor Yellow
Write-Host "  cd apps\api" -ForegroundColor White
Write-Host "  npm run prisma:migrate" -ForegroundColor White
Write-Host "  npm run seed" -ForegroundColor White

pause


