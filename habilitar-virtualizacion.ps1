# Script para habilitar virtualización en Windows
# DEBE EJECUTARSE COMO ADMINISTRADOR

Write-Host "=== HABILITANDO VIRTUALIZACIÓN EN WINDOWS ===" -ForegroundColor Cyan
Write-Host "Este script requiere permisos de administrador" -ForegroundColor Yellow
Write-Host ""

# Verificar si se ejecuta como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "✗ Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Haz clic derecho en el archivo y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✓ Ejecutándose como Administrador" -ForegroundColor Green
Write-Host ""

# Habilitar características de Windows necesarias
Write-Host "1. Habilitando Hyper-V..." -ForegroundColor Yellow
try {
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart -ErrorAction SilentlyContinue
    Write-Host "   ✓ Hyper-V habilitado (puede requerir reinicio)" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Hyper-V: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "2. Habilitando características de contenedores..." -ForegroundColor Yellow
try {
    Enable-WindowsOptionalFeature -Online -FeatureName Containers -NoRestart -ErrorAction SilentlyContinue
    Write-Host "   ✓ Contenedores habilitados" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Contenedores: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Verificando WSL2..." -ForegroundColor Yellow
try {
    $wslStatus = wsl --status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ WSL2 está instalado" -ForegroundColor Green
        
        # Asegurar que WSL2 sea la versión predeterminada
        wsl --set-default-version 2 2>&1 | Out-Null
        Write-Host "   ✓ WSL2 configurado como predeterminado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ WSL2 no está instalado, instalando..." -ForegroundColor Yellow
        wsl --install
    }
} catch {
    Write-Host "   ⚠ WSL2: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4. Configurando Hypervisor Launch Type..." -ForegroundColor Yellow
try {
    # Verificar configuración actual
    $current = bcdedit /enum | Select-String "hypervisorlaunchtype"
    Write-Host "   Configuración actual: $current" -ForegroundColor Cyan
    
    # Intentar habilitar (puede requerir que la virtualización esté habilitada en BIOS)
    bcdedit /set hypervisorlaunchtype auto 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Hypervisor configurado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ No se pudo configurar (puede requerir habilitar en BIOS)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ Error: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== RESUMEN ===" -ForegroundColor Cyan
Write-Host "Si la virtualización sigue sin funcionar, necesitarás:" -ForegroundColor Yellow
Write-Host "1. Habilitar 'Virtualization Technology' en la BIOS/UEFI" -ForegroundColor White
Write-Host "2. Reiniciar el equipo" -ForegroundColor White
Write-Host "3. Después del reinicio, ejecutar: .\verificar-docker.ps1" -ForegroundColor White
Write-Host ""
Write-Host "¿Deseas reiniciar ahora? (S/N)" -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "S" -or $response -eq "s") {
    Write-Host "Reiniciando en 10 segundos..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Restart-Computer
} else {
    Write-Host "Reinicia manualmente cuando estés listo" -ForegroundColor Cyan
}

pause


