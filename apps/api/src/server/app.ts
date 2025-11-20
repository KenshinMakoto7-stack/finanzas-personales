import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middleware/error.js";
import authRoutes from "../routes/auth.routes.js";
import accountsRoutes from "../routes/accounts.routes.js";
import categoriesRoutes from "../routes/categories.routes.js";
import transactionsRoutes from "../routes/transactions.routes.js";
import goalsRoutes from "../routes/goals.routes.js";
import budgetRoutes from "../routes/budget.routes.js";
import reportsRoutes from "../routes/reports.routes.js";
import exportRoutes from "../routes/export.routes.js";
import alertsRoutes from "../routes/alerts.routes.js";
import statisticsRoutes from "../routes/statistics.routes.js";
import budgetsRoutes from "../routes/budgets.routes.js";
import tagsRoutes from "../routes/tags.routes.js";
import patternsRoutes from "../routes/patterns.routes.js";
import searchRoutes from "../routes/search.routes.js";
import notificationsRoutes from "../routes/notifications.routes.js";
import exchangeRoutes from "../routes/exchange.routes.js";
import debtsRoutes from "../routes/debts.routes.js";
import { openApiDoc } from "../swagger/openapi.js";

const app = express();

app.use(helmet());
// CORS: Permitir origen desde variable de entorno o localhost en desarrollo
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : process.env.NODE_ENV === 'production' 
    ? [] 
    : ['http://localhost:3000', 'http://localhost:3001'];
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' && allowedOrigins.length > 0
    ? allowedOrigins
    : true, 
  credentials: true 
}));
app.use(express.json());
app.use(morgan("dev"));
app.use(pinoHttp());

app.get("/", (_req, res) => res.json({ 
  message: "Personal Finance API", 
  version: "1.0.0",
  endpoints: {
    health: "/health",
    docs: "/docs",
    auth: "/auth",
    accounts: "/accounts",
    categories: "/categories",
    transactions: "/transactions",
    goals: "/goals",
    budget: "/budget",
    budgets: "/budgets",
    reports: "/reports",
    export: "/export",
    alerts: "/alerts",
    statistics: "/statistics",
    tags: "/tags",
    patterns: "/patterns",
    search: "/search",
    notifications: "/notifications",
    exchange: "/exchange",
    debts: "/debts"
  }
}));

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
app.use("/statistics", statisticsRoutes);
app.use("/budgets", budgetsRoutes);
app.use("/tags", tagsRoutes);
app.use("/patterns", patternsRoutes);
app.use("/search", searchRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/exchange", exchangeRoutes);
app.use("/debts", debtsRoutes);

app.use(errorHandler);
export default app;


