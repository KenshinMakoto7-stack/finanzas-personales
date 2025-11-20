# Script para configurar el proyecto después de instalar PostgreSQL

Write-Host "=== CONFIGURANDO PROYECTO ===" -ForegroundColor Cyan

# Verificar que PostgreSQL esté instalado
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "Error: PostgreSQL no está en el PATH" -ForegroundColor Red
    Write-Host "Asegúrate de que PostgreSQL esté instalado y reinicia PowerShell" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✓ PostgreSQL encontrado" -ForegroundColor Green

# Verificar conexión
Write-Host "Verificando conexión a PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
try {
    $result = & psql -U postgres -h localhost -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Conexión exitosa" -ForegroundColor Green
    } else {
        Write-Host "✗ No se pudo conectar. Verifica que PostgreSQL esté corriendo." -ForegroundColor Red
        Write-Host "Intenta iniciar el servicio: net start postgresql-x64-15" -ForegroundColor Yellow
        pause
        exit 1
    }
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    pause
    exit 1
}

# Crear base de datos si no existe
Write-Host "Verificando base de datos 'pf_db'..." -ForegroundColor Yellow
$dbExists = & psql -U postgres -h localhost -lqt 2>&1 | Select-String "pf_db"
if (-not $dbExists) {
    Write-Host "Creando base de datos 'pf_db'..." -ForegroundColor Yellow
    & psql -U postgres -h localhost -c "CREATE DATABASE pf_db;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de datos creada" -ForegroundColor Green
    } else {
        Write-Host "✗ Error al crear base de datos" -ForegroundColor Red
        pause
        exit 1
    }
} else {
    Write-Host "✓ Base de datos ya existe" -ForegroundColor Green
}

# Actualizar .env de la API
Write-Host "Actualizando archivo .env de la API..." -ForegroundColor Yellow
$apiEnvPath = "$PSScriptRoot\apps\api\.env"
$envContent = @"
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pf_db?schema=public
JWT_SECRET=dev-secret-change-in-production-12345
NODE_ENV=development
"@

try {
    Set-Content -Path $apiEnvPath -Value $envContent -Force
    Write-Host "✓ Archivo .env actualizado" -ForegroundColor Green
} catch {
    Write-Host "⚠ Error al actualizar .env: $_" -ForegroundColor Yellow
}

# Configurar Prisma
Write-Host ""
Write-Host "=== CONFIGURANDO PRISMA ===" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\apps\api"

Write-Host "Generando cliente de Prisma..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Cliente de Prisma generado" -ForegroundColor Green
} else {
    Write-Host "✗ Error al generar cliente de Prisma" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Ejecutando migraciones..." -ForegroundColor Yellow
npm run prisma:migrate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Migraciones completadas" -ForegroundColor Green
} else {
    Write-Host "✗ Error en las migraciones" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Poblando base de datos con datos de prueba..." -ForegroundColor Yellow
npm run seed
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Base de datos poblada" -ForegroundColor Green
} else {
    Write-Host "⚠ Error al poblar base de datos (puede que ya esté poblada)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== ¡CONFIGURACIÓN COMPLETA! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Todo está listo. Puedes iniciar los servicios:" -ForegroundColor Cyan
Write-Host ""
Write-Host "API:" -ForegroundColor Yellow
Write-Host "  cd apps\api" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Web:" -ForegroundColor Yellow
Write-Host "  cd apps\web" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Mobile:" -ForegroundColor Yellow
Write-Host "  cd apps\mobile" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor White
Write-Host ""

pause


