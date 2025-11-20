PROJECT_BLUEPRINT.md — App de Finanzas Personales (Full-Stack, Web+Móvil)
0) Visión, Alcance y Principios

Visión: Ayudar a cualquier persona a controlar su dinero día a día con un sistema claro de ingresos, metas de ahorro y promedio de gasto diario dinámico con rollover. Multiplataforma (web PWA y móvil con Expo).

Alcance (versión completa):

Gestión de cuentas, categorías jerárquicas, transacciones (ingresos/gastos/transferencias).

Meta de ahorro mensual y presupuesto diario dinámico con rollover.

Reportes por mes y por categoría.

Exportación CSV/JSON.

Alertas básicas (sobre-gasto/meta).

Web PWA offline con cola de sincronización.

App móvil Expo (iOS/Android) consumiendo la misma API.

Principios:

Un solo lenguaje: TypeScript end-to-end.

Montos en centavos (enteros) para evitar errores de flotantes.

Fechas guardadas en UTC; cálculos por zona horaria del usuario.

Seguridad desde el inicio: Argon2, JWT, validación Zod.

Arquitectura escalable y comprensible por perfiles junior/intermedios.

1) Quick Start (Dev)
1.1 Requisitos

Node.js 20+

pnpm 9+ (o npm/yarn)

Docker + Docker Compose (para Postgres)

Git

1.2 Estructura del monorepo
personal-finance/
├─ apps/
│  ├─ api/            # API Express + Prisma + OpenAPI + tests
│  ├─ web/            # Next.js (App Router) + PWA + cola offline
│  └─ mobile/         # Expo (React Native) app
├─ packages/
│  └─ shared/         # Tipos y utilidades compartidas (Zod, helpers)
├─ infra/
│  ├─ docker-compose.yml   # Postgres + pgAdmin (opc)
│  └─ .env.example
├─ docs/
│  ├─ BLUE_NOTE.md         # Casos de uso detallados (incluido aquí)
│  ├─ API.md               # Endpoints (referencia)
│  ├─ SECURITY.md
│  ├─ ADR/
│  │  ├─ 0001-stack.md
│  │  └─ 0002-centavos.md
│  └─ features/            # Gherkin (aceptación)
├─ package.json            # Workspaces
├─ pnpm-workspace.yaml
└─ README.md

1.3 Levantar entorno
# 1) Clonar repo y entrar
git clone <tu-repo> personal-finance
cd personal-finance

# 2) Crear archivos desde este blueprint (Cursor te ayuda a generar contenidos)

# 3) Infra: levantar Postgres
cd infra
cp .env.example .env
docker compose up -d

# 4) Instalar dependencias
cd ..
pnpm install

# 5) Preparar API (migraciones/seed)
cd apps/api
cp .env.example .env    # ajusta JWT_SECRET y DATABASE_URL (usa la del docker-compose)
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed

# 6) Ejecutar API
pnpm dev

# 7) Ejecutar Web (en otra terminal)
cd ../../apps/web
cp .env.example .env
pnpm dev

# 8) Ejecutar Mobile (en otra terminal)
cd ../../apps/mobile
cp .env.example .env
pnpm start   # abre Expo

2) BlueNote — Casos de Uso (acordado)

Este apartado define el “qué” en detalle.
Se usa como contrato para diseño, DB, API y UI.

2.1 Principios clave y glosario

Disponible mes = IngresosMes − MetaMes − GastosMes.

Promedio de hoy = floor(DisponibleInicioDelDía / DíasRestantesIncluyendoHoy).

Rollover hoy = max(PromedioHoy − GastoHoy, 0) → incrementa DisponibleCierre; sube promedio de mañana.

Zona horaria: todos los cálculos diarios/mensuales respetan TZ del usuario (DB UTC).

Transferencias: no alteran disponible (sirven para mover entre cuentas).

Multi‑moneda (completo): moneda por cuenta (conversiones simples opcionales). Para evitar complejidad legal y de tipos de cambio, por defecto moneda única por usuario; multi‑moneda se habilita como opción (ver ADR).

2.2 Catálogo de casos de uso (resumen)

UC‑001 Registro • UC‑002 Login • UC‑003 Preferencias (moneda, TZ)

UC‑004 Cuentas (CRUD)

UC‑005 Categorías jerárquicas (CRUD)

UC‑006 Gasto • UC‑007 Ingreso • UC‑016 Transferencia

UC‑008 Editar/Eliminar transacción

UC‑009 Meta mensual (upsert)

UC‑010 Resumen + Promedio + Rollover

UC‑011 Filtros/Busqueda • UC‑012 Reportes • UC‑013 Alertas • UC‑014 Exportaciones

UC‑015 Modo Offline (PWA)

UC‑017 App móvil (Expo) con los UC principales

Los escenarios detallados y Gherkin están en docs/BLUE_NOTE.md y docs/features/* (Cursor los puede derivar de la versión del apartado 2 que ya viste en chats anteriores; aquí nos enfocamos en el código).

3) Diseño de Sistema y Arquitectura
3.1 Stack

API: Node.js 20, Express, Prisma, PostgreSQL, Zod, Argon2, JWT, Luxon, Pino/Morgan, Swagger.

Web: Next.js (App Router), React 18, Zustand/Context, fetch/axios, next-pwa, manifest, cola offline.

Móvil: Expo/React Native, React Navigation, axios.

Compartido: TypeScript (tipos, Zod schemas, helpers fechas/moneda).

Tests: Vitest (unit), Playwright (e2e web opcional).

Infra: Docker Compose (Postgres), dotenv.

3.2 Diagrama (alto nivel)
[Web PWA] ─┐
           ├─(HTTPS/JSON)─> [API Express/Prisma] ──> [PostgreSQL]
[Mobile] ──┘                      ↑
                                  └── [OpenAPI docs]

4) Datos y Esquema (Prisma)

Archivo: apps/api/prisma/schema.prisma

// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AccountType {
  CASH
  BANK
  CREDIT
  OTHER
}

enum CategoryType {
  INCOME
  EXPENSE
}

enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  name          String?
  currencyCode  String         @default("USD")
  locale        String?        @default("en-US")
  timeZone      String?        @default("UTC")
  createdAt     DateTime       @default(now())

  accounts      Account[]
  categories    Category[]
  transactions  Transaction[]
  goals         MonthlyGoal[]
}

model Account {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  type         AccountType
  currencyCode String
  createdAt    DateTime      @default(now())

  transactions Transaction[]

  @@index([userId])
}

model Category {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String
  type           CategoryType
  parentId       String?
  parent         Category?    @relation("CategoryToSubcategories", fields: [parentId], references: [id])
  subcategories  Category[]   @relation("CategoryToSubcategories")
  createdAt      DateTime     @default(now())

  @@index([userId])
  @@index([userId, parentId])
}

model Transaction {
  id           String          @id @default(cuid())
  userId       String
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId    String
  account      Account         @relation(fields: [accountId], references: [id])
  categoryId   String?
  category     Category?       @relation(fields: [categoryId], references: [id])
  type         TransactionType
  amountCents  Int             // enteros
  occurredAt   DateTime        // UTC
  description  String?
  createdAt    DateTime        @default(now())

  @@index([userId, occurredAt])
  @@index([userId, categoryId])
  @@index([userId, accountId])
}

model MonthlyGoal {
  id               String     @id @default(cuid())
  userId           String
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  month            DateTime   // primer día del mes en UTC
  savingGoalCents  Int
  createdAt        DateTime   @default(now())

  @@unique([userId, month])
  @@index([userId, month])
}

5) API — Código (Express + Prisma + Zod + JWT + Luxon)
5.1 package.json y tsconfig

apps/api/package.json

{
  "name": "@pf/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "seed": "ts-node src/seed.ts",
    "openapi": "node scripts/openapi.js"
  },
  "dependencies": {
    "@pf/shared": "workspace:*",
    "@prisma/client": "^5.20.0",
    "argon2": "^0.30.6",
    "cors": "^2.8.5",
    "date-fns": "^3.6.0",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "luxon": "^3.5.0",
    "morgan": "^1.10.0",
    "pino": "^9.0.0",
    "pino-http": "^9.0.0",
    "swagger-ui-express": "^5.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.12.12",
    "prisma": "^5.20.0",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.1"
  }
}


apps/api/tsconfig.json

{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2020",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@pf/shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src", "prisma", "scripts"]
}


apps/api/.env.example

PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pf_db?schema=public
JWT_SECRET=CAMBIA_ESTE_VALOR
NODE_ENV=development

5.2 Infra y bootstrap de la app

apps/api/src/index.ts

import "dotenv/config";
import app from "./server/app";

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});


apps/api/src/server/app.ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/error";
import authRoutes from "../routes/auth.routes";
import accountsRoutes from "../routes/accounts.routes";
import categoriesRoutes from "../routes/categories.routes";
import transactionsRoutes from "../routes/transactions.routes";
import goalsRoutes from "../routes/goals.routes";
import budgetRoutes from "../routes/budget.routes";
import reportsRoutes from "../routes/reports.routes";
import exportRoutes from "../routes/export.routes";
import alertsRoutes from "../routes/alerts.routes";
import { openApiDoc } from "../swagger/openapi";

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(pinoHttp());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Docs (OpenAPI)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));

// Rutas
app.use("/auth", authRoutes);
app.use("/accounts", accountsRoutes);
app.use("/categories", categoriesRoutes);
app.use("/transactions", transactionsRoutes);
app.use("/goals", goalsRoutes);
app.use("/budget", budgetRoutes);
app.use("/reports", reportsRoutes);
app.use("/export", exportRoutes);
app.use("/alerts", alertsRoutes);

app.use(errorHandler);
export default app;


apps/api/src/server/middleware/auth.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { userId: string };
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.user = { userId: payload.userId };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}


apps/api/src/server/middleware/error.ts

import { Request, Response, NextFunction } from "express";
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
}


apps/api/src/lib/db.ts

import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();


apps/api/src/lib/crypto.ts

import argon2 from "argon2";
export const hashPassword = (plain: string) => argon2.hash(plain);
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);


apps/api/src/lib/time.ts

import { DateTime } from "luxon";

/** Retorna inicio y fin de día en TZ del usuario (en UTC) */
export function dayRangeUTC(dateISO: string, timeZone: string) {
  const d = DateTime.fromISO(dateISO, { zone: timeZone });
  const start = d.startOf("day").toUTC();
  const end = d.endOf("day").toUTC();
  return { start: start.toJSDate(), end: end.toJSDate(), dayOfMonth: d.day };
}

/** Retorna el primer y último día del MES de dateISO en TZ, en UTC, y días en el mes */
export function monthRangeUTC(dateISO: string, timeZone: string) {
  const d = DateTime.fromISO(dateISO, { zone: timeZone });
  const start = d.startOf("month").toUTC();
  const end = d.endOf("month").toUTC();
  return { start: start.toJSDate(), end: end.toJSDate(), year: d.year, month: d.month, daysInMonth: d.daysInMonth };
}

/** Convierte año/mes a primer día UTC (convención para MonthlyGoal) */
export function monthAnchorUTC(year: number, month: number) {
  return DateTime.utc(year, month, 1, 0, 0, 0).toJSDate();
}

5.3 Validación (Zod) compartida

packages/shared/package.json

{
  "name": "@pf/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "zod": "^3.23.8",
    "luxon": "^3.5.0"
  }
}


packages/shared/src/schemas.ts

import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  currencyCode: z.string().default("USD"),
  locale: z.string().default("en-US"),
  timeZone: z.string().default("UTC")
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const AccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CASH","BANK","CREDIT","OTHER"]),
  currencyCode: z.string().min(3).max(3)
});

export const CategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME","EXPENSE"]),
  parentId: z.string().cuid().nullable().optional()
});

export const TransactionSchema = z.object({
  accountId: z.string().cuid(),
  categoryId: z.string().cuid().nullable().optional(),
  type: z.enum(["INCOME","EXPENSE","TRANSFER"]),
  amountCents: z.number().int().positive(),
  occurredAt: z.string(), // ISO
  description: z.string().optional()
});

export const GoalSchema = z.object({
  year: z.number().int().min(1970).max(2100),
  month: z.number().int().min(1).max(12),
  savingGoalCents: z.number().int().min(0)
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type TransactionInput = z.infer<typeof TransactionSchema>;


packages/shared/src/index.ts

export * from "./schemas";

5.4 Rutas y controladores (API)

AUTH

apps/api/src/routes/auth.routes.ts

import { Router } from "express";
import { register, login, me, updatePrefs } from "../controllers/auth.controller";
import { requireAuth } from "../server/middleware/auth";
const r = Router();
r.post("/register", register);
r.post("/login", login);
r.get("/me", requireAuth, me);
r.put("/prefs", requireAuth, updatePrefs);
export default r;


apps/api/src/controllers/auth.controller.ts

import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/crypto";
import { RegisterSchema, LoginSchema } from "@pf/shared";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function register(req: Request, res: Response) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, name, currencyCode, locale, timeZone } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email ya registrado" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, name, currencyCode, locale, timeZone } });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email, name, currencyCode, locale, timeZone } });
}

export async function login(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, currencyCode: user.currencyCode, locale: user.locale, timeZone: user.timeZone } });
}

export async function me(req: Request & { user?: { userId: string } }, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "No encontrado" });
  res.json({ user: { id: user.id, email: user.email, name: user.name, currencyCode: user.currencyCode, locale: user.locale, timeZone: user.timeZone } });
}

export async function updatePrefs(req: Request & { user?: { userId: string } }, res: Response) {
  const { currencyCode, locale, timeZone, name } = req.body || {};
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { currencyCode: currencyCode || undefined, locale: locale || undefined, timeZone: timeZone || undefined, name: name || undefined }
  });
  res.json({ user: { id: user.id, email: user.email, name: user.name, currencyCode: user.currencyCode, locale: user.locale, timeZone: user.timeZone } });
}


ACCOUNTS

apps/api/src/routes/accounts.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { listAccounts, createAccount, updateAccount, deleteAccount } from "../controllers/accounts.controller";
const r = Router();
r.use(requireAuth);
r.get("/", listAccounts);
r.post("/", createAccount);
r.put("/:id", updateAccount);
r.delete("/:id", deleteAccount);
export default r;


apps/api/src/controllers/accounts.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { AccountSchema } from "@pf/shared";

export async function listAccounts(req: Request & { user?: { userId: string } }, res: Response) {
  const rows = await prisma.account.findMany({ where: { userId: req.user!.userId }, orderBy: { createdAt: "asc" }});
  res.json({ accounts: rows });
}

export async function createAccount(req: Request & { user?: { userId: string } }, res: Response) {
  const parsed = AccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, type, currencyCode } = parsed.data;
  const acc = await prisma.account.create({ data: { userId: req.user!.userId, name, type, currencyCode }});
  res.status(201).json({ account: acc });
}

export async function updateAccount(req: Request & { user?: { userId: string } }, res: Response) {
  const { name } = req.body || {};
  const acc = await prisma.account.update({ where: { id: req.params.id }, data: { name: name || undefined }});
  res.json({ account: acc });
}

export async function deleteAccount(req: Request & { user?: { userId: string } }, res: Response) {
  // Si tiene transacciones, podrías bloquear o pedir migración (post‑MVP: fusionar)
  await prisma.account.delete({ where: { id: req.params.id }});
  res.status(204).send();
}


CATEGORIES

apps/api/src/routes/categories.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categories.controller";
const r = Router();
r.use(requireAuth);
r.get("/", listCategories);
r.post("/", createCategory);
r.put("/:id", updateCategory);
r.delete("/:id", deleteCategory);
export default r;


apps/api/src/controllers/categories.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { CategorySchema } from "@pf/shared";

export async function listCategories(req: Request & { user?: { userId: string } }, res: Response) {
  const type = (req.query.type as string) || undefined;
  const rows = await prisma.category.findMany({
    where: { userId: req.user!.userId, ...(type ? { type: type as any } : {}) },
    orderBy: { createdAt: "asc" }
  });
  res.json({ categories: rows });
}

export async function createCategory(req: Request & { user?: { userId: string } }, res: Response) {
  const parsed = CategorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, type, parentId } = parsed.data;
  const cat = await prisma.category.create({ data: { userId: req.user!.userId, name, type, parentId: parentId || null }});
  res.status(201).json({ category: cat });
}

export async function updateCategory(req: Request & { user?: { userId: string } }, res: Response) {
  const { name } = req.body || {};
  const cat = await prisma.category.update({ where: { id: req.params.id }, data: { name: name || undefined }});
  res.json({ category: cat });
}

export async function deleteCategory(req: Request & { user?: { userId: string } }, res: Response) {
  // Para simplicidad: permitir borrar si no tiene transacciones relacionadas
  // (producción: bloquear/merge). Prisma lanzará error si hay FK.
  await prisma.category.delete({ where: { id: req.params.id }});
  res.status(204).send();
}


TRANSACTIONS (incluye TRANSFER)

apps/api/src/routes/transactions.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from "../controllers/transactions.controller";
const r = Router();
r.use(requireAuth);
r.get("/", listTransactions);     // filtros: ?from&to&categoryId&accountId&page&pageSize
r.post("/", createTransaction);
r.put("/:id", updateTransaction);
r.delete("/:id", deleteTransaction);
export default r;


apps/api/src/controllers/transactions.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { TransactionSchema } from "@pf/shared";

export async function listTransactions(req: Request & { user?: { userId: string } }, res: Response) {
  const { from, to, categoryId, accountId, page = "1", pageSize = "50" } = req.query as any;
  const where: any = { userId: req.user!.userId };
  if (from || to) where.occurredAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (categoryId) where.categoryId = String(categoryId);
  if (accountId)  where.accountId  = String(accountId);
  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy: { occurredAt: "desc" }, skip, take }),
    prisma.transaction.count({ where })
  ]);
  res.json({ transactions: rows, page: Number(page), pageSize: take, total });
}

export async function createTransaction(req: Request & { user?: { userId: string } }, res: Response) {
  const parsed = TransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { accountId, categoryId, type, amountCents, occurredAt, description } = parsed.data;

  const tx = await prisma.transaction.create({
    data: {
      userId: req.user!.userId,
      accountId,
      categoryId: categoryId || null,
      type,
      amountCents: Number(amountCents),
      occurredAt: new Date(occurredAt),
      description: description || null
    }
  });
  res.status(201).json({ transaction: tx });
}

export async function updateTransaction(req: Request & { user?: { userId: string } }, res: Response) {
  const { accountId, categoryId, type, amountCents, occurredAt, description } = req.body || {};
  const tx = await prisma.transaction.update({
    where: { id: req.params.id },
    data: {
      accountId: accountId || undefined,
      categoryId: categoryId ?? undefined,
      type: type || undefined,
      amountCents: amountCents !== undefined ? Number(amountCents) : undefined,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      description: description || undefined
    }
  });
  res.json({ transaction: tx });
}

export async function deleteTransaction(req: Request & { user?: { userId: string } }, res: Response) {
  await prisma.transaction.delete({ where: { id: req.params.id }});
  res.status(204).send();
}


GOALS

apps/api/src/routes/goals.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { upsertGoal, getGoal } from "../controllers/goals.controller";
const r = Router();
r.use(requireAuth);
r.put("/:year/:month", upsertGoal);
r.get("/:year/:month", getGoal);
export default r;


apps/api/src/controllers/goals.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { monthAnchorUTC } from "../lib/time";

export async function upsertGoal(req: Request & { user?: { userId: string } }, res: Response) {
  const year = Number(req.params.year), month = Number(req.params.month);
  const { savingGoalCents } = req.body || {};
  const monthDate = monthAnchorUTC(year, month);

  const goal = await prisma.monthlyGoal.upsert({
    where: { userId_month: { userId: req.user!.userId, month: monthDate } },
    create: { userId: req.user!.userId, month: monthDate, savingGoalCents: Number(savingGoalCents || 0) },
    update: { savingGoalCents: Number(savingGoalCents || 0) }
  });
  res.json({ goal });
}

export async function getGoal(req: Request & { user?: { userId: string } }, res: Response) {
  const year = Number(req.params.year), month = Number(req.params.month);
  const monthDate = monthAnchorUTC(year, month);
  const goal = await prisma.monthlyGoal.findUnique({ where: { userId_month: { userId: req.user!.userId, month: monthDate } }});
  res.json({ goal });
}


BUDGET (lógica de promedio con rollover)

apps/api/src/services/budget.service.ts

import { prisma } from "../lib/db";
import { monthRangeUTC, dayRangeUTC } from "../lib/time";

/** Función pura: cálculo del promedio y rollover (todos en centavos) */
export function computeDailyBudgetWithRollover(params: {
  year: number;
  month: number;                // 1..12
  dayOfMonth: number;           // 1..31 según mes
  daysInMonth: number;
  totalIncomeCents: number;
  spentBeforeTodayCents: number;
  spentTodayCents: number;
  savingGoalCents: number;
}) {
  const { year, month, dayOfMonth, daysInMonth, totalIncomeCents, spentBeforeTodayCents, spentTodayCents, savingGoalCents } = params;

  const availableStartCents = totalIncomeCents - savingGoalCents - spentBeforeTodayCents;
  const remainingDaysIncludingToday = Math.max(daysInMonth - dayOfMonth + 1, 1);
  const dailyTargetTodayStartCents = Math.floor(availableStartCents / remainingDaysIncludingToday);

  const availableEndOfDayCents = availableStartCents - spentTodayCents;
  const rolloverFromTodayCents = Math.max(dailyTargetTodayStartCents - spentTodayCents, 0);

  const remainingDaysExcludingToday = Math.max(daysInMonth - dayOfMonth, 0);
  const dailyTargetTomorrowCents =
    remainingDaysExcludingToday > 0 ? Math.floor(availableEndOfDayCents / remainingDaysExcludingToday) : 0;

  const overspend = availableEndOfDayCents < 0;
  const overspendCents = overspend ? Math.abs(availableEndOfDayCents) : 0;

  return {
    month: { year, month, daysInMonth, today: dayOfMonth },
    startOfDay: {
      availableCents: availableStartCents,
      remainingDaysIncludingToday,
      dailyTargetCents: dailyTargetTodayStartCents
    },
    endOfDay: {
      availableCents: availableEndOfDayCents,
      remainingDaysExcludingToday,
      dailyTargetTomorrowCents,
      rolloverFromTodayCents
    },
    safety: { overspend, overspendCents }
  };
}

/** Servicio: calcula el resumen para el usuario en una fecha (respetando su TZ) */
export async function getBudgetSummaryForDate(userId: string, dateISO: string, userTimeZone: string, year?: number, month?: number) {
  // Rango del mes y del día en UTC (a partir de dateISO interpretado en TZ)
  const monthRange = monthRangeUTC(dateISO, userTimeZone);
  const dayRange = dayRangeUTC(dateISO, userTimeZone);

  // Meta del mes (si no existe, 0)
  const goal = await prisma.monthlyGoal.findUnique({
    where: { userId_month: { userId, month: new Date(Date.UTC(monthRange.year, monthRange.month - 1, 1)) } }
  });
  const savingGoalCents = goal?.savingGoalCents ?? 0;

  // Ingresos del mes
  const incomesAgg = await prisma.transaction.aggregate({
    _sum: { amountCents: true },
    where: { userId, type: "INCOME", occurredAt: { gte: monthRange.start, lte: monthRange.end } }
  });
  const totalIncomeCents = incomesAgg._sum.amountCents ?? 0;

  // Gastos hasta ayer
  const spentBeforeAgg = await prisma.transaction.aggregate({
    _sum: { amountCents: true },
    where: { userId, type: "EXPENSE", occurredAt: { gte: monthRange.start, lt: dayRange.start } }
  });
  const spentBeforeTodayCents = spentBeforeAgg._sum.amountCents ?? 0;

  // Gastos de hoy
  const spentTodayAgg = await prisma.transaction.aggregate({
    _sum: { amountCents: true },
    where: { userId, type: "EXPENSE", occurredAt: { gte: dayRange.start, lte: dayRange.end } }
  });
  const spentTodayCents = spentTodayAgg._sum.amountCents ?? 0;

  const calc = computeDailyBudgetWithRollover({
    year: monthRange.year,
    month: monthRange.month,
    dayOfMonth: dayRange.dayOfMonth,
    daysInMonth: monthRange.daysInMonth,
    totalIncomeCents,
    spentBeforeTodayCents,
    spentTodayCents,
    savingGoalCents
  });

  return { params: { date: dateISO, timeZone: userTimeZone }, data: calc };
}


apps/api/src/routes/budget.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { budgetSummary } from "../controllers/budget.controller";
const r = Router();
r.use(requireAuth);
r.get("/summary", budgetSummary); // ?date=YYYY-MM-DD
export default r;


apps/api/src/controllers/budget.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { getBudgetSummaryForDate } from "../services/budget.service";

export async function budgetSummary(req: Request & { user?: { userId: string } }, res: Response) {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";
  const result = await getBudgetSummaryForDate(req.user!.userId, date, tz);
  res.json(result);
}


REPORTES y EXPORTACIÓN

apps/api/src/routes/reports.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { monthlyByCategory } from "../controllers/reports.controller";
const r = Router();
r.use(requireAuth);
r.get("/monthly-by-category", monthlyByCategory); // ?year=2025&month=11&type=EXPENSE|INCOME
export default r;


apps/api/src/controllers/reports.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { monthAnchorUTC } from "../lib/time";

export async function monthlyByCategory(req: Request & { user?: { userId: string } }, res: Response) {
  const year = Number(req.query.year), month = Number(req.query.month);
  const type = (req.query.type as "EXPENSE"|"INCOME") || "EXPENSE";
  const start = monthAnchorUTC(year, month);
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    _sum: { amountCents: true },
    where: { userId: req.user!.userId, type, occurredAt: { gte: start, lte: end } }
  });

  const categories = await prisma.category.findMany({ where: { id: { in: rows.map(r => r.categoryId!).filter(Boolean) as string[] } }});
  const map = Object.fromEntries(categories.map(c => [c.id, c]));
  const data = rows.map(r => ({
    categoryId: r.categoryId,
    categoryName: r.categoryId ? map[r.categoryId]?.name ?? "(Sin categoría)" : "(Sin categoría)",
    amountCents: r._sum.amountCents ?? 0
  }));
  res.json({ data });
}


apps/api/src/routes/export.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { exportCSV, exportJSON } from "../controllers/export.controller";
const r = Router();
r.use(requireAuth);
r.get("/csv", exportCSV);   // ?from=ISO&to=ISO
r.get("/json", exportJSON); // ?from&to
export default r;


apps/api/src/controllers/export.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";

export async function exportCSV(req: Request & { user?: { userId: string } }, res: Response) {
  const { from, to } = req.query as any;
  const where: any = { userId: req.user!.userId };
  if (from || to) where.occurredAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

  const txs = await prisma.transaction.findMany({ where, orderBy: { occurredAt: "asc" }, include: { account: true, category: true }});
  const header = "date,type,amountCents,account,category,description\n";
  const rows = txs.map(t =>
    [
      t.occurredAt.toISOString(),
      t.type,
      t.amountCents,
      t.account.name,
      t.category?.name || "",
      (t.description || "").replace(/[\n,]/g, " ")
    ].join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
  res.send(header + rows + "\n");
}

export async function exportJSON(req: Request & { user?: { userId: string } }, res: Response) {
  const { from, to } = req.query as any;
  const where: any = { userId: req.user!.userId };
  if (from || to) where.occurredAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  const txs = await prisma.transaction.findMany({ where, orderBy: { occurredAt: "asc" }});
  res.json({ transactions: txs });
}


ALERTAS (básicas en cálculo, sin email/push en prod)

apps/api/src/routes/alerts.routes.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/auth";
import { alertsPreview } from "../controllers/alerts.controller";
const r = Router();
r.use(requireAuth);
r.get("/preview", alertsPreview); // ?date=YYYY-MM-DD
export default r;


apps/api/src/controllers/alerts.controller.ts

import { Request, Response } from "express";
import { prisma } from "../lib/db";
import { getBudgetSummaryForDate } from "../services/budget.service";

export async function alertsPreview(req: Request & { user?: { userId: string } }, res: Response) {
  const date = (req.query.date as string) || new Date().toISOString().slice(0,10);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }});
  const tz = user?.timeZone || "UTC";
  const result = await getBudgetSummaryForDate(req.user!.userId, date, tz);
  const alerts: Array<{ level: "info"|"warn"|"danger"; message: string }> = [];

  if (result.data.safety.overspend) {
    alerts.push({ level: "danger", message: "Has gastado por encima del disponible del mes." });
  }
  const diff = result.data.startOfDay.dailyTargetCents - (result.data.endOfDay.availableCents < 0 ? 0 : result.data.endOfDay.rolloverFromTodayCents);
  // Nota: solo ejemplo; puedes añadir más reglas
  if (result.data.startOfDay.dailyTargetCents < 0) {
    alerts.push({ level: "warn", message: "Tu promedio de hoy es negativo: ajusta meta o ingresos." });
  }
  res.json({ alerts, budget: result.data });
}

5.5 OpenAPI (Swagger) — documentación de endpoints

apps/api/src/swagger/openapi.ts (resumen mínimo; Cursor puede expandir)

export const openApiDoc = {
  openapi: "3.0.0",
  info: { title: "Personal Finance API", version: "1.0.0" },
  servers: [{ url: "http://localhost:4000" }],
  paths: {
    "/auth/register": { post: { summary: "Registro", responses: { "200": { description: "OK" } } } },
    "/auth/login": { post: { summary: "Login", responses: { "200": { description: "OK" } } } },
    "/budget/summary": { get: { summary: "Resumen presupuesto", parameters: [{ name: "date", in: "query" }], responses: { "200": { description: "OK" } } } }
    // Agrega más rutas según controllers
  }
} as const;

5.6 Seed de datos (para demos y QA)

apps/api/src/seed.ts

import "dotenv/config";
import { prisma } from "./lib/db";
import { hashPassword } from "./lib/crypto";

async function main() {
  const email = "ana@example.com";
  const passwordHash = await hashPassword("Secreta123");

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, currencyCode: "USD", locale: "es-AR", timeZone: "America/Argentina/Buenos_Aires" }
  });

  const cash = await prisma.account.upsert({
    where: { id: "seed-cash" }, // truco para evitar duplicates; puedes usar find/create
    update: {},
    create: { id: "seed-cash", userId: user.id, name: "Efectivo", type: "CASH", currencyCode: "USD" }
  });

  const comida = await prisma.category.create({
    data: { userId: user.id, name: "COMIDA", type: "EXPENSE" }
  });
  const almuerzo = await prisma.category.create({
    data: { userId: user.id, name: "Almuerzo", type: "EXPENSE", parentId: comida.id }
  });
  const ingresos = await prisma.category.create({
    data: { userId: user.id, name: "INGRESOS", type: "INCOME" }
  });

  // Meta noviembre 2025
  await prisma.monthlyGoal.upsert({
    where: { userId_month: { userId: user.id, month: new Date(Date.UTC(2025, 10, 1)) } },
    update: { savingGoalCents: 30000 },
    create: { userId: user.id, month: new Date(Date.UTC(2025, 10, 1)), savingGoalCents: 30000 }
  });

  // Ingreso sueldo
  await prisma.transaction.create({
    data: { userId: user.id, accountId: cash.id, categoryId: ingresos.id, type: "INCOME", amountCents: 300000, occurredAt: new Date("2025-11-01T12:00:00Z"), description: "Sueldo" }
  });

  // Gasto previo
  await prisma.transaction.create({
    data: { userId: user.id, accountId: cash.id, categoryId: almuerzo.id, type: "EXPENSE", amountCents: 120000, occurredAt: new Date("2025-11-10T15:00:00Z"), description: "Gastos previos" }
  });

  // Gasto de hoy (ejemplo)
  await prisma.transaction.create({
    data: { userId: user.id, accountId: cash.id, categoryId: almuerzo.id, type: "EXPENSE", amountCents: 3000, occurredAt: new Date("2025-11-18T13:00:00Z"), description: "Almuerzo 18/11" }
  });

  console.log("Seed completado");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

5.7 Tests (Vitest) — núcleo de negocio

apps/api/src/services/budget.service.test.ts

import { describe, it, expect } from "vitest";
import { computeDailyBudgetWithRollover } from "./budget.service";

describe("computeDailyBudgetWithRollover", () => {
  it("calcula promedio y rollover", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025, month: 11, dayOfMonth: 18, daysInMonth: 30,
      totalIncomeCents: 300000,
      savingGoalCents: 30000,
      spentBeforeTodayCents: 120000,
      spentTodayCents: 3000
    });
    expect(res.startOfDay.availableCents).toBe(150000);
    expect(res.startOfDay.dailyTargetCents).toBe(11538);   // floor(150000/13)
    expect(res.endOfDay.availableCents).toBe(147000);
    expect(res.endOfDay.dailyTargetTomorrowCents).toBe(12250);
    expect(res.endOfDay.rolloverFromTodayCents).toBe(8538);
  });
});

6) Web (Next.js, PWA, Offline Queue)
6.1 Configuración

apps/web/package.json

{
  "name": "@pf/web",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000"
  },
  "dependencies": {
    "@pf/shared": "workspace:*",
    "axios": "^1.6.8",
    "next": "^14.2.5",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/react": "^18.2.66",
    "typescript": "^5.6.3"
  }
}


apps/web/next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true }
};
export default nextConfig;


apps/web/.env.example

NEXT_PUBLIC_API_URL=http://localhost:4000

6.2 App Router — páginas clave

apps/web/app/layout.tsx

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}


apps/web/app/page.tsx (si no logueado → login)

import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Finanzas Personales</h1>
      <p><Link href="/login">Iniciar sesión</Link> o <Link href="/signup">Crear cuenta</Link></p>
    </main>
  );
}


Estado/Auth y Cliente API

apps/web/lib/api.ts

import axios from "axios";

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

export function setAuthToken(token?: string) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export default api;


apps/web/store/auth.ts

import { create } from "zustand";
import api, { setAuthToken } from "../lib/api";

type User = { id: string; email: string; name?: string; currencyCode: string; locale?: string; timeZone?: string };
type State = { user?: User; token?: string; login: (email:string, password:string)=>Promise<void>; logout: ()=>void; register:(p:any)=>Promise<void> };

export const useAuth = create<State>((set) => ({
  async login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    setAuthToken(res.data.token);
    set({ token: res.data.token, user: res.data.user });
    if (typeof window !== "undefined") localStorage.setItem("token", res.data.token);
  },
  logout() {
    setAuthToken(undefined);
    set({ token: undefined, user: undefined });
    if (typeof window !== "undefined") localStorage.removeItem("token");
  },
  async register(payload) {
    const res = await api.post("/auth/register", payload);
    setAuthToken(res.data.token);
    set({ token: res.data.token, user: res.data.user });
    if (typeof window !== "undefined") localStorage.setItem("token", res.data.token);
  }
}));


apps/web/app/login/page.tsx

"use client";
import { useState } from "react";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const [email,setEmail] = useState(""); const [password,setPassword]=useState("");
  const [error,setError] = useState<string>();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try { await login(email,password); router.push("/dashboard"); }
    catch (err:any) { setError(err?.response?.data?.error ?? "Error"); }
  }

  return (
    <main style={{ padding: 24, maxWidth: 360 }}>
      <h2>Iniciar sesión</h2>
      <form onSubmit={onSubmit}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:"100%", padding:8, marginBottom:8 }}/>
        <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:"100%", padding:8, marginBottom:8 }}/>
        {error && <p style={{ color:"crimson" }}>{error}</p>}
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}


apps/web/app/signup/page.tsx

"use client";
import { useState } from "react";
import { useAuth } from "../../store/auth";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const { register } = useAuth();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [currencyCode,setCurrencyCode]=useState("USD"); const [timeZone,setTimeZone]=useState("UTC");
  const [error,setError]=useState<string>(); const router=useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try { await register({ email, password, currencyCode, timeZone }); router.push("/dashboard"); }
    catch (err:any) { setError(err?.response?.data?.error ?? "Error"); }
  }

  return (
    <main style={{ padding:24, maxWidth:360 }}>
      <h2>Crear cuenta</h2>
      <form onSubmit={onSubmit}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:"100%", padding:8, marginBottom:8 }}/>
        <input type="password" placeholder="Contraseña (≥8)" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:"100%", padding:8, marginBottom:8 }}/>
        <input placeholder="Moneda (ej. USD)" value={currencyCode} onChange={e=>setCurrencyCode(e.target.value)} style={{ width:"100%", padding:8, marginBottom:8 }}/>
        <input placeholder="Zona horaria (ej. America/Argentina/Buenos_Aires)" value={timeZone} onChange={e=>setTimeZone(e.target.value)} style={{ width:"100%", padding:8, marginBottom:8 }}/>
        {error && <p style={{ color:"crimson" }}>{error}</p>}
        <button type="submit">Crear</button>
      </form>
    </main>
  );
}


apps/web/app/dashboard/page.tsx

"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../lib/api";
import { useAuth } from "../../store/auth";

function fmtMoney(cents: number, currency="USD") {
  return new Intl.NumberFormat(undefined,{ style:"currency", currency }).format(cents/100);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data,setData] = useState<any>(); const [alerts,setAlerts]=useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("token"); if (token) setAuthToken(token);
    (async () => {
      const today = new Date().toISOString().slice(0,10);
      const res = await api.get(`/budget/summary?date=${today}`);
      setData(res.data.data);
      const a = await api.get(`/alerts/preview?date=${today}`);
      setAlerts(a.data.alerts);
    })();
  }, []);

  if (!user) return <main style={{ padding:24 }}><p>Inicia sesión.</p></main>;
  if (!data) return <main style={{ padding:24 }}><p>Cargando...</p></main>;

  return (
    <main style={{ padding:24 }}>
      <h2>Resumen</h2>
      <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))" }}>
        <div style={{ border:"1px solid #ddd", padding:12 }}>
          <strong>Disponible inicio</strong>
          <div>{fmtMoney(data.startOfDay.availableCents, user.currencyCode)}</div>
          <small>Días restantes (incl. hoy): {data.startOfDay.remainingDaysIncludingToday}</small>
        </div>
        <div style={{ border:"1px solid #ddd", padding:12 }}>
          <strong>Promedio HOY</strong>
          <div>{fmtMoney(data.startOfDay.dailyTargetCents, user.currencyCode)}</div>
        </div>
        <div style={{ border:"1px solid #ddd", padding:12 }}>
          <strong>Disponible cierre (simulado)</strong>
          <div>{fmtMoney(data.endOfDay.availableCents, user.currencyCode)}</div>
        </div>
        <div style={{ border:"1px solid #ddd", padding:12 }}>
          <strong>Promedio MAÑANA</strong>
          <div>{fmtMoney(data.endOfDay.dailyTargetTomorrowCents, user.currencyCode)}</div>
        </div>
      </div>

      <h3 style={{ marginTop:24 }}>Alertas</h3>
      {alerts.length===0 ? <p>Sin alertas.</p> : alerts.map((a,i)=><div key={i} style={{ padding:8, background:a.level==="danger"?"#ffe3e3":a.level==="warn"?"#fff2cc":"#e5f5ff", marginBottom:8 }}>{a.message}</div>)}

      <div style={{ marginTop:24 }}>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/export/csv`} target="_blank">Exportar CSV</a>
      </div>
    </main>
  );
}


Alta rápida de gasto (form sencillo)

apps/web/app/transactions/new/page.tsx

"use client";
import { useEffect, useState } from "react";
import api, { setAuthToken } from "../../../lib/api";
import { useAuth } from "../../../store/auth";

export default function NewTransactionPage() {
  const { user } = useAuth();
  const [accounts,setAccounts]=useState<any[]>([]);
  const [categories,setCategories]=useState<any[]>([]);
  const [accountId,setAccountId]=useState(""); const [categoryId,setCategoryId]=useState("");
  const [amount,setAmount]=useState(""); const [desc,setDesc]=useState("");
  const [type,setType]=useState<"EXPENSE"|"INCOME">("EXPENSE");
  const [msg,setMsg]=useState<string>();

  useEffect(()=>{
    const token=localStorage.getItem("token"); if(token) setAuthToken(token);
    (async ()=>{
      const acc=await api.get("/accounts"); setAccounts(acc.data.accounts);
      const cat=await api.get("/categories?type="+type); setCategories(cat.data.categories);
    })();
  },[type]);

  async function save() {
    const amountCents = Math.round(Number(amount) * 100);
    const occurredAt = new Date().toISOString();
    await api.post("/transactions",{ accountId, categoryId, type, amountCents, occurredAt, description: desc });
    setMsg("Guardado"); setAmount(""); setDesc("");
  }

  return (
    <main style={{ padding:24, maxWidth:420 }}>
      <h2>Nueva transacción</h2>
      <div>
        <label>Tipo:&nbsp;</label>
        <select value={type} onChange={e=>setType(e.target.value as any)}>
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Ingreso</option>
        </select>
      </div>
      <div>
        <label>Cuenta:&nbsp;</label>
        <select value={accountId} onChange={e=>setAccountId(e.target.value)}>
          <option value="">(elige)</option>
          {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label>Categoría:&nbsp;</label>
        <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
          <option value="">(opcional)</option>
          {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div><input placeholder="Importe (ej. 12.34)" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
      <div><input placeholder="Nota (opcional)" value={desc} onChange={e=>setDesc(e.target.value)} /></div>
      <button onClick={save}>Guardar</button>
      {msg && <p>{msg}</p>}
    </main>
  );
}

6.3 PWA — manifest y (cola) offline simple

apps/web/public/manifest.json

{
  "name": "Finanzas Personales",
  "short_name": "Finanzas",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "icons": []
}


Cola offline mínima (si cae conexión, guarda POSTs y reintenta)

apps/web/lib/offlineQueue.ts

type Req = { url: string; method: "POST"|"PUT"|"DELETE"; body: any };
const KEY = "pf_offline_queue";

function getQ(): Req[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function setQ(q: Req[]) { localStorage.setItem(KEY, JSON.stringify(q)); }

export function enqueue(req: Req) {
  const q = getQ(); q.push(req); setQ(q);
}

export async function flush(fetcher: (r: Req)=>Promise<void>) {
  const q = getQ(); const next: Req[] = [];
  for (const r of q) {
    try { await fetcher(r); } catch { next.push(r); }
  }
  setQ(next);
}


Integración: Si api.post(...) falla por red, llamar enqueue({ url:"/transactions", method:"POST", body:payload }). Un setInterval o un detector window.online puede disparar flush.

7) Móvil (Expo/React Native)

apps/mobile/package.json

{
  "name": "@pf/mobile",
  "private": true,
  "main": "index.js",
  "scripts": {
    "start": "expo start -c",
    "android": "expo run:android",
    "ios": "expo run:ios"
  },
  "dependencies": {
    "expo": "^51.0.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "axios": "^1.6.8",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17"
  }
}


apps/mobile/App.tsx

import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, TextInput, Button, FlatList } from "react-native";
import axios from "axios";

const API = "http://localhost:4000"; // ajustar si usas dispositivo físico
const Stack = createNativeStackNavigator();

function Login({ navigation }: any) {
  const [email,setEmail]=useState("ana@example.com");
  const [password,setPassword]=useState("Secreta123");
  async function onLogin() {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
    navigation.replace("Dashboard");
  }
  return (
    <View style={{ padding:16 }}>
      <Text>Login</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Entrar" onPress={onLogin} />
    </View>
  );
}

function Dashboard({ navigation }: any) {
  const [data,setData] = useState<any>();
  useEffect(() => {
    (async ()=>{
      const today = new Date().toISOString().slice(0,10);
      const res = await axios.get(`${API}/budget/summary?date=${today}`);
      setData(res.data.data);
    })();
  }, []);
  return (
    <View style={{ padding:16 }}>
      <Text>Resumen</Text>
      {!data ? <Text>Cargando...</Text> :
        <>
          <Text>Disponible inicio: {data.startOfDay.availableCents/100}</Text>
          <Text>Promedio hoy: {data.startOfDay.dailyTargetCents/100}</Text>
          <Text>Promedio mañana: {data.endOfDay.dailyTargetTomorrowCents/100}</Text>
        </>
      }
      <Button title="Nuevo gasto" onPress={()=>navigation.navigate("NewTx")} />
    </View>
  );
}

function NewTx({ navigation }: any) {
  const [accounts,setAccounts]=useState<any[]>([]);
  const [categories,setCategories]=useState<any[]>([]);
  const [accountId,setAccountId]=useState(""); const [categoryId,setCategoryId]=useState("");
  const [amount,setAmount]=useState("");

  useEffect(()=>{(async()=>{
    const a = await axios.get(`${API}/accounts`); setAccounts(a.data.accounts);
    const c = await axios.get(`${API}/categories?type=EXPENSE`); setCategories(c.data.categories);
  })()},[]);

  async function save() {
    const amountCents = Math.round(Number(amount)*100);
    const occurredAt = new Date().toISOString();
    await axios.post(`${API}/transactions`, { accountId, categoryId, type:"EXPENSE", amountCents, occurredAt });
    navigation.goBack();
  }

  return (
    <View style={{ padding:16 }}>
      <Text>Nuevo Gasto</Text>
      <Text>Cuenta: {accounts[0]?.name} (usa primer ID por simplicidad)</Text>
      {accounts[0] && setAccountId(accounts[0].id)}
      <Text>Categoría: {categories[0]?.name}</Text>
      {categories[0] && setCategoryId(categories[0].id)}
      <TextInput placeholder="Importe (12.34)" value={amount} onChangeText={setAmount}/>
      <Button title="Guardar" onPress={save}/>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={Login}/>
        <Stack.Screen name="Dashboard" component={Dashboard}/>
        <Stack.Screen name="NewTx" component={NewTx}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

8) Infraestructura

infra/docker-compose.yml

version: "3.9"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_USER: postgres
      POSTGRES_DB: pf_db
    ports:
      - "5432:5432"
    volumes:
      - pf_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - db

volumes:
  pf_data:


infra/.env.example (ajusta si lo usas para compose extendido)

# Placeholder para variables infra si las necesitas

9) Documentación (copiar como archivos)

README.md

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


docs/API.md

# API (resumen)
- POST /auth/register { email, password, currencyCode?, locale?, timeZone? } -> { token, user }
- POST /auth/login { email, password } -> { token, user }
- GET  /auth/me -> { user }
- PUT  /auth/prefs { currencyCode?, locale?, timeZone?, name? } -> { user }

- GET  /accounts
- POST /accounts { name, type, currencyCode }
- PUT  /accounts/:id { name? }
- DELETE /accounts/:id

- GET  /categories?type=EXPENSE|INCOME
- POST /categories { name, type, parentId? }
- PUT  /categories/:id { name? }
- DELETE /categories/:id

- GET  /transactions?from&to&categoryId&accountId&page&pageSize
- POST /transactions { accountId, categoryId?, type, amountCents, occurredAt, description? }
- PUT  /transactions/:id { ... }
- DELETE /transactions/:id

- PUT  /goals/:year/:month { savingGoalCents }
- GET  /goals/:year/:month

- GET  /budget/summary?date=YYYY-MM-DD   -> cálculo promedio/rollover
- GET  /reports/monthly-by-category?year&month&type=EXPENSE|INCOME
- GET  /export/csv?from&to
- GET  /export/json?from&to
- GET  /alerts/preview?date=YYYY-MM-DD


docs/SECURITY.md

# Seguridad
- Contraseñas: Argon2.
- JWT con secreto fuerte; expiración 7 días.
- Validación Zod en todas las entradas.
- Logs de acceso y errores (pino/morgan).
- CORS restringido en producción.
- Rate limiting recomendado en /auth/* (añadir express-rate-limit o rate-limiter-flexible).
- Backups de DB.
- Variables en .env (no commitear).


docs/ADR/0001-stack.md

# ADR 0001 — Stack
Decisión: TypeScript on all layers; Express + Prisma + Postgres; Next.js web; Expo móvil.
Alternativas: NestJS; Django/DRF; Rails. Se elige TS por unificación y DX.


docs/ADR/0002-centavos.md

# ADR 0002 — Montos en centavos
Se evita flotante. Todas las sumas y divisiones usan enteros; redondeo por piso.

10) Postman/cURL de ejemplo
# Registro
curl -X POST http://localhost:4000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"Secreta123","currencyCode":"USD","timeZone":"America/Argentina/Buenos_Aires"}'

# Login
curl -X POST http://localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"Secreta123"}'

# Presupuesto de hoy (reemplaza <TOKEN>)
curl "http://localhost:4000/budget/summary?date=2025-11-18" -H "Authorization: Bearer <TOKEN>"

11) Checklists finales (DoR/DoD)

DoR (Ready): Caso de uso con criterios Gherkin; validaciones definidas; dependencias claras.

DoD (Done): Tests pasan; docs actualizadas; logs sin errores; endpoints probados con Postman.

12) Notas de despliegue (Prod)

API detrás de reverse proxy con HTTPS; CORS restringido a dominios de web/móvil.

DB: Postgres gestionado, backups diarios.

Web: Vercel/Netlify (ajustar NEXT_PUBLIC_API_URL).

Móvil: Build con EAS (Expo) y configuración de API pública.

Monitoreo: logs centralizados, alertas (overspend) opcionalmente vía email/SMS (integrar SendGrid/SES — no incluido aquí).

13) TODOs (copiar a backlog)
// TODO: Implementar rate limiting en /auth/*.
// TODO: Mejorar eliminación de categorías con transacciones (merge helper).
// TODO: Añadir presupuestos por categoría (sub-función de reports).
// TODO: Mejorar PWA offline: background sync con Service Worker.
// TODO: Multi-moneda por cuenta con conversión (opción avanzada).
// TODO: Playwright E2E para flujos web clave (login, nuevo gasto, dashboard).