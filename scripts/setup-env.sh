#!/bin/bash
# Script para generar archivo .env.example con todas las variables necesarias

cat > .env.example << 'EOF'
# API Configuration
PORT=4000
NODE_ENV=production

# Database (Railway proporcionará esta URL)
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secret (genera uno seguro)
JWT_SECRET=tu-secreto-super-seguro-minimo-32-caracteres-aqui

# CORS (actualizar con URL de Vercel después del deployment)
CORS_ORIGIN=https://tu-app.vercel.app
FRONTEND_URL=https://tu-app.vercel.app

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password-de-gmail
EOF

echo "✅ Archivo .env.example creado"
echo "📝 Actualiza los valores antes de usar en producción"

