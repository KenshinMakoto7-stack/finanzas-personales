/**
 * Sistema de Monitoreo y Observabilidad
 * Integración con Sentry para error tracking y performance monitoring
 */

import * as Sentry from "@sentry/node";
import { Request, Response, NextFunction } from "express";

// Configuración de Sentry
const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || "development";
const RELEASE = process.env.APP_VERSION || "1.0.0";

/**
 * Inicializa Sentry si está configurado
 */
export function initMonitoring() {
  if (!SENTRY_DSN) {
    console.log("⚠️  SENTRY_DSN no configurado - Monitoreo deshabilitado");
    return false;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `finanzas-api@${RELEASE}`,
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === "production" ? 0.2 : 1.0,
    
    // Configuración de errores
    beforeSend(event, hint) {
      // Filtrar errores de validación (no son bugs)
      if (event.exception?.values?.[0]?.type === "ValidationError") {
        return null;
      }
      
      // No enviar errores 4xx en producción (son esperados)
      const statusCode = (hint.originalException as any)?.statusCode;
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        return null;
      }
      
      return event;
    },
    
    // Integrations
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    
    // Ignorar errores comunes
    ignoreErrors: [
      "ECONNRESET",
      "ECONNREFUSED",
      "socket hang up",
      "Request aborted",
    ],
  });

  console.log(`✅ Sentry inicializado - Env: ${ENVIRONMENT}`);
  return true;
}

/**
 * Middleware para capturar requests en Sentry
 */
export function sentryRequestHandler() {
  if (!SENTRY_DSN) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return Sentry.expressIntegration().setupOnce as any;
}

/**
 * Middleware para capturar errores en Sentry
 */
export function sentryErrorHandler() {
  if (!SENTRY_DSN) {
    return (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err);
  }
  return Sentry.expressErrorHandler();
}

/**
 * Captura un error manualmente con contexto adicional
 */
export function captureError(
  error: Error,
  context?: {
    userId?: string;
    action?: string;
    extra?: Record<string, any>;
  }
) {
  if (!SENTRY_DSN) {
    console.error("[ERROR]", error.message, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.action) {
      scope.setTag("action", context.action);
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    Sentry.captureException(error);
  });
}

/**
 * Captura un mensaje/evento personalizado
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  extra?: Record<string, any>
) {
  if (!SENTRY_DSN) {
    console.log(`[${level.toUpperCase()}]`, message, extra);
    return;
  }

  Sentry.withScope((scope) => {
    if (extra) {
      scope.setExtras(extra);
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Inicia una transacción para medir performance
 */
export function startTransaction(name: string, op: string) {
  if (!SENTRY_DSN) {
    return {
      finish: () => {},
      setStatus: () => {},
      startChild: () => ({ finish: () => {} }),
    };
  }

  return Sentry.startInactiveSpan({ name, op });
}

/**
 * Logger estructurado con niveles y contexto
 */
export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    const log = { level: "info", message, timestamp: new Date().toISOString(), ...meta };
    console.log(JSON.stringify(log));
  },

  warn: (message: string, meta?: Record<string, any>) => {
    const log = { level: "warn", message, timestamp: new Date().toISOString(), ...meta };
    console.warn(JSON.stringify(log));
    captureMessage(message, "warning", meta);
  },

  error: (message: string, error?: Error, meta?: Record<string, any>) => {
    const log = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      error: error?.message,
      stack: error?.stack,
      ...meta,
    };
    console.error(JSON.stringify(log));
    if (error) {
      captureError(error, { extra: meta });
    }
  },

  debug: (message: string, meta?: Record<string, any>) => {
    if (ENVIRONMENT !== "production") {
      const log = { level: "debug", message, timestamp: new Date().toISOString(), ...meta };
      console.log(JSON.stringify(log));
    }
  },
};

/**
 * Middleware para logging de requests
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const log = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: (req as any).user?.userId,
        userAgent: req.get("user-agent"),
        ip: req.ip,
      };

      // Solo loguear requests lentos o errores en producción
      if (ENVIRONMENT === "production") {
        if (duration > 1000 || res.statusCode >= 500) {
          logger.warn("Slow or failed request", log);
        }
      } else {
        logger.debug("Request completed", log);
      }
    });

    next();
  };
}

/**
 * Métricas de aplicación
 */
class Metrics {
  private counters: Map<string, number> = new Map();
  private timings: Map<string, number[]> = new Map();

  increment(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  timing(name: string, durationMs: number) {
    const timings = this.timings.get(name) || [];
    timings.push(durationMs);
    // Mantener solo últimas 1000 mediciones
    if (timings.length > 1000) timings.shift();
    this.timings.set(name, timings);
  }

  getStats() {
    const stats: Record<string, any> = {
      counters: Object.fromEntries(this.counters),
      timings: {},
    };

    for (const [name, values] of this.timings) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        stats.timings[name] = {
          count: values.length,
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)],
        };
      }
    }

    return stats;
  }

  reset() {
    this.counters.clear();
    this.timings.clear();
  }
}

export const metrics = new Metrics();

/**
 * Wrapper para medir tiempo de funciones async
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.timing(name, Date.now() - start);
    metrics.increment(`${name}.success`);
    return result;
  } catch (error) {
    metrics.timing(name, Date.now() - start);
    metrics.increment(`${name}.error`);
    throw error;
  }
}

/**
 * Health check detallado
 */
export async function getHealthStatus() {
  const health: Record<string, any> = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: ENVIRONMENT,
    version: RELEASE,
    metrics: metrics.getStats(),
  };

  // Check Firebase connection
  try {
    const { db } = await import("./firebase");
    await db.collection("_health").doc("check").get();
    health.firebase = "connected";
  } catch (error) {
    health.firebase = "error";
    health.status = "degraded";
  }

  return health;
}

