# Dockerfile para deploy en Cloud Run
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build
WORKDIR /app/apps/api
RUN npm run build

# Imagen de producción
FROM node:20-alpine AS runner

WORKDIR /app

# Copiar solo lo necesario
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]

