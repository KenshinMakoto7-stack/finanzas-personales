# Script para verificar Docker y configurar la base de datos
Write-Host "=== VERIFICANDO DOCKER ===" -ForegroundColor Cyan

# Verificar Docker
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker instalado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker no está disponible" -ForegroundColor Red
    exit 1
}

# Verificar que Docker Desktop esté corriendo
Write-Host "`nVerificando Docker Desktop..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

try {
    $containers = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker Desktop está funcionando" -ForegroundColor Green
    } else {
        Write-Host "✗ Docker Desktop no está iniciado. Por favor inícialo manualmente." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error al conectar con Docker" -ForegroundColor Red
    exit 1
}

# Levantar la base de datos
Write-Host "`n=== LEVANTANDO BASE DE DATOS ===" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\infra"

try {
    docker compose up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de datos iniciada" -ForegroundColor Green
        Write-Host "Esperando a que PostgreSQL esté listo..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    } else {
        Write-Host "✗ Error al levantar la base de datos" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    exit 1
}

# Configurar Prisma
Write-Host "`n=== CONFIGURANDO PRISMA ===" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\apps\api"

try {
    Write-Host "Generando cliente de Prisma..." -ForegroundColor Yellow
    npm run prisma:generate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Cliente de Prisma generado" -ForegroundColor Green
    }
    
    Write-Host "Ejecutando migraciones..." -ForegroundColor Yellow
    npm run prisma:migrate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migraciones completadas" -ForegroundColor Green
    }
    
    Write-Host "Poblando base de datos con datos de prueba..." -ForegroundColor Yellow
    npm run seed
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de datos poblada" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== ¡TODO LISTO! ===" -ForegroundColor Green
Write-Host "La base de datos está configurada y lista para usar." -ForegroundColor Green
Write-Host "`nPuedes iniciar la API con: cd apps\api && npm run dev" -ForegroundColor Cyan
Write-Host "Puedes iniciar la Web con: cd apps\web && npm run dev" -ForegroundColor Cyan


