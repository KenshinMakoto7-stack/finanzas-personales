#!/bin/bash
# Script para deployment en Railway
# Este script prepara el proyecto para Railway

echo "🚀 Preparando deployment en Railway..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
  echo "❌ Error: No se encuentra package.json. Ejecuta desde la raíz del proyecto."
  exit 1
fi

echo "✅ Proyecto listo para Railway"
echo ""
echo "📋 Próximos pasos:"
echo "1. Ve a https://railway.app"
echo "2. Login con GitHub"
echo "3. New Project → Deploy from GitHub repo"
echo "4. Selecciona tu repositorio"
echo "5. Configura:"
echo "   - Root Directory: apps/api"
echo "   - Build Command: npm install && npm run build"
echo "   - Start Command: npm start"
echo "6. Agrega PostgreSQL desde el panel"
echo "7. Configura las variables de entorno (ver README_DEPLOYMENT.md)"

