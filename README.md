# Personal Finance — Monorepo

## Apps
- `apps/api`: API Express + Prisma + JWT + Zod + Swagger
- `apps/web`: Next.js PWA
- `apps/mobile`: Expo

## Quick Start
1) `cd infra && docker compose up -d`
2) `pnpm i`
3) `cd apps/api && cp .env.example .env && pnpm prisma:generate && pnpm prisma:migrate && pnpm seed && pnpm dev`
4) `cd apps/web && cp .env.example .env && pnpm dev`
5) `cd apps/mobile && cp .env.example .env && pnpm start`

## Notas
- Montos en **centavos**.
- Fechas en UTC; cálculos por TZ usuario (Luxon).
- Seguridad: Argon2, JWT, validación Zod.



