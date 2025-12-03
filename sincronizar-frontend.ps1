# Script para sincronizar frontend del monorepo a finanzas-web
Write-Host "🔄 Sincronizando archivos del frontend..." -ForegroundColor Cyan

$monorepoPath = "C:\Users\Gamer\Desktop\PROYECTO_APP_FINANZA\apps\web"
$frontendRepoPath = "C:\Users\Gamer\Desktop\finanzas-web"

# Archivos y carpetas a copiar
$filesToSync = @(
    "app\globals.css",
    "app\dashboard\page.tsx",
    "app\transactions\page.tsx",
    "app\transactions\new\page.tsx",
    "app\debts\page.tsx",
    "app\accounts\page.tsx",
    "app\categories\page.tsx",
    "app\tags\page.tsx",
    "app\savings\page.tsx",
    "app\statistics\page.tsx",
    "app\patterns\page.tsx",
    "app\recurring\page.tsx",
    "app\login\page.tsx",
    "app\signup\page.tsx",
    "app\forgot-password\page.tsx",
    "app\reset-password\page.tsx",
    "app\page.tsx",
    "app\layout.tsx",
    "app\providers.tsx",
    "components\ui\Tooltip.tsx",
    "components\ui\index.ts"
)

$copied = 0
$errors = 0

foreach ($file in $filesToSync) {
    $sourcePath = Join-Path $monorepoPath $file
    $destPath = Join-Path $frontendRepoPath $file
    
    if (Test-Path $sourcePath) {
        try {
            # Crear directorio destino si no existe
            $destDir = Split-Path $destPath -Parent
            if (!(Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Host "✅ Copiado: $file" -ForegroundColor Green
            $copied++
        } catch {
            Write-Host "❌ Error copiando $file : $_" -ForegroundColor Red
            $errors++
        }
    } else {
        Write-Host "⚠️  No encontrado: $file" -ForegroundColor Yellow
    }
}

Write-Host "`n📊 Resumen:" -ForegroundColor Cyan
Write-Host "   ✅ Copiados: $copied" -ForegroundColor Green
Write-Host "   ❌ Errores: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })

if ($errors -eq 0) {
    Write-Host "`n✨ Sincronización completada exitosamente!" -ForegroundColor Green
    Write-Host "`n📝 Próximos pasos:" -ForegroundColor Cyan
    Write-Host "   1. cd C:\Users\Gamer\Desktop\finanzas-web" -ForegroundColor White
    Write-Host "   2. git status" -ForegroundColor White
    Write-Host "   3. git add -A" -ForegroundColor White
    Write-Host "   4. git commit -m 'feat: Sincronizar cambios del monorepo - Mejoras 1, 3, 4 y 6'" -ForegroundColor White
    Write-Host "   5. git push origin main" -ForegroundColor White
} else {
    Write-Host "`n⚠️  Hubo errores durante la sincronización. Revisa los mensajes arriba." -ForegroundColor Yellow
}

