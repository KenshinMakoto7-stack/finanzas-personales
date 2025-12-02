# Script para verificar la configuración de SendGrid
# Ejecutar después de configurar las variables en Render

Write-Host "=== Verificación de Configuración SendGrid ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que las variables estén documentadas
Write-Host "Variables que DEBES tener en Render:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. SMTP_HOST=sendgrid" -ForegroundColor Green
Write-Host "2. SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx" -ForegroundColor Green
Write-Host "3. SENDGRID_FROM_EMAIL=tu-email-verificado@tudominio.com" -ForegroundColor Green
Write-Host ""

Write-Host "Pasos para verificar:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Ve a Render Dashboard → Tu Servicio → Environment" -ForegroundColor White
Write-Host "2. Verifica que las 3 variables estén presentes" -ForegroundColor White
Write-Host "3. Ve a Logs y busca mensajes de email" -ForegroundColor White
Write-Host "4. Prueba recuperación de contraseña en la app" -ForegroundColor White
Write-Host ""

Write-Host "Mensajes que DEBES ver en los logs:" -ForegroundColor Yellow
Write-Host "✅ Password reset email sent successfully to [email]" -ForegroundColor Green
Write-Host ""

Write-Host "Mensajes que NO DEBES ver:" -ForegroundColor Yellow
Write-Host "❌ ⚠️ EMAIL NO ENVIADO" -ForegroundColor Red
Write-Host "❌ Email service not configured" -ForegroundColor Red
Write-Host ""

Write-Host "=== Verificación completada ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si ves errores, revisa:" -ForegroundColor Yellow
Write-Host "- Que las variables estén correctamente escritas" -ForegroundColor White
Write-Host "- Que el servicio se haya reiniciado después de agregar las variables" -ForegroundColor White
Write-Host "- Que el email en SENDGRID_FROM_EMAIL esté verificado en SendGrid" -ForegroundColor White
Write-Host ""

