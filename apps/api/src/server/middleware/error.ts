import { Request, Response, NextFunction } from "express";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

/**
 * Clase de error personalizada para errores operacionales
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler centralizado mejorado
 * - Logging estructurado
 * - Mensajes amigables en producción
 * - No expone detalles internos
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // Logging estructurado
  if (err instanceof AppError) {
    logger.warn({
      err,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId
    }, 'Operational error');
  } else {
    logger.error({
      err,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.userId,
      body: process.env.NODE_ENV === 'development' ? req.body : undefined
    }, 'Unexpected error');
  }

  // Respuesta al cliente
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err instanceof AppError) {
    // Error operacional: mostrar mensaje al cliente
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(isDevelopment && { stack: err.stack })
    });
  } else if (err.status || err.statusCode) {
    // Error con status code (ej: de validación)
    const statusCode = err.status || err.statusCode;
    res.status(statusCode).json({
      error: err.message || 'Error en la solicitud',
      ...(isDevelopment && { details: err })
    });
  } else {
    // Error inesperado: no exponer detalles en producción
    res.status(500).json({
      error: isDevelopment 
        ? err.message || 'Error interno del servidor'
        : 'Error interno del servidor. Por favor, intenta más tarde.',
      ...(isDevelopment && { 
        stack: err.stack,
        details: err 
      })
    });
  }
}



