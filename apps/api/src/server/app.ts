// Optimizaciones de rendimiento aplicadas - Deploy trigger
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/error.js";
import { initMonitoring, sentryErrorHandler, requestLogger, getHealthStatus, logger } from "../lib/monitoring.js";
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
import plannedEventsRoutes from "../routes/planned-events.routes.js";
import aiAnalysisRoutes from "../routes/ai-analysis.routes.js";
import debtsRoutes from "../routes/debts.routes.js";
import { openApiDoc } from "../swagger/openapi.js";

// Inicializar monitoreo (Sentry)
initMonitoring();

const app = express();

// Configurar trust proxy para Render (necesario para rate limiting correcto)
// Configurar específicamente para Render: confiar solo en el primer proxy (Render)
app.set('trust proxy', 1);

// Request logging estructurado
app.use(requestLogger());

// Rate Limiting - General (100 requests per 15 min)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta nuevamente en unos minutos." },
  skip: (req) => req.path === "/health" // No limitar health checks
});

// Rate Limiting - Auth (20 requests per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Relajado para testing, ajustar en producción real
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de autenticación. Intenta nuevamente en 15 minutos." }
});

// Rate Limiting - API general (más permisivo para usuarios autenticados)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta nuevamente en un momento." }
});

// CORS: Configuración robusta
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({ 
  origin: (origin, callback) => {
    // Permitir requests sin origin (como Postman, curl, mobile apps)
    if (!origin) return callback(null, true);
    
    // En desarrollo (sin CORS_ORIGIN), permitir localhost
    if (!process.env.CORS_ORIGIN) {
      const devOrigins = ['http://localhost:3000', 'http://localhost:3001'];
      if (devOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // En producción, verificar contra lista permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
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
    debts: "/debts",
    plannedEvents: "/planned-events",
    aiAnalysis: "/ai-analysis"
  }
}));

// Health check básico
app.get("/health", (_req, res) => res.json({ ok: true }));

// Health check detallado con métricas
app.get("/health/detailed", async (_req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Health check failed", error as Error);
    res.status(503).json({ status: "error", error: "Health check failed" });
  }
});

// Aplicar rate limiting general
app.use(generalLimiter);

// Docs (OpenAPI)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));

// Rutas con rate limiting específico
app.use("/auth", authLimiter, authRoutes);
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
app.use("/planned-events", plannedEventsRoutes);
app.use("/ai-analysis", aiAnalysisRoutes);

// Sentry error handler (debe ir antes del error handler general)
app.use(sentryErrorHandler());

app.use(errorHandler);
export default app;


