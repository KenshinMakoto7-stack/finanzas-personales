import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Middleware de validación centralizada usando Zod
 * Valida el body del request contra un schema y sanitiza los datos
 */
export function validate<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        path: e.path.join("."),
        message: e.message
      }));
      
      return res.status(400).json({
        error: "Error de validación",
        details: errors
      });
    }
    
    // Reemplazar body con datos validados y sanitizados
    req.body = result.data;
    next();
  };
}

/**
 * Middleware para validar query params
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        path: e.path.join("."),
        message: e.message
      }));
      
      return res.status(400).json({
        error: "Error de validación en parámetros",
        details: errors
      });
    }
    
    req.query = result.data;
    next();
  };
}

/**
 * Middleware para validar params de ruta
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        path: e.path.join("."),
        message: e.message
      }));
      
      return res.status(400).json({
        error: "Error de validación en parámetros de ruta",
        details: errors
      });
    }
    
    req.params = result.data;
    next();
  };
}

// ============================================
// SCHEMAS DE VALIDACIÓN MEJORADOS
// ============================================

// Helpers de validación
const sanitizeString = (s: string) => s.trim().slice(0, 500);
const isReasonableDate = (date: Date) => {
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
};

// Schema base para transacciones
export const TransactionCreateSchema = z.object({
  accountId: z.string().min(1, "Cuenta es requerida"),
  categoryId: z.string().nullable().optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"], {
    errorMap: () => ({ message: "Tipo debe ser INCOME, EXPENSE o TRANSFER" })
  }),
  amountCents: z.number()
    .int("El monto debe ser un número entero")
    .positive("El monto debe ser positivo")
    .max(999999999999, "El monto es demasiado grande"), // ~10 billones
  occurredAt: z.string()
    .refine(val => !isNaN(Date.parse(val)), "Fecha inválida")
    .transform(val => new Date(val))
    .refine(isReasonableDate, "La fecha debe estar entre 1900 y 2100"),
  description: z.string()
    .max(500, "La descripción no puede exceder 500 caracteres")
    .transform(sanitizeString)
    .optional(),
  currencyCode: z.string().length(3, "El código de moneda debe tener 3 caracteres").optional(),
  isRecurring: z.boolean().optional(),
  debtId: z.string().optional(),
  tagIds: z.array(z.string()).optional()
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial();

// Schema para cuentas
export const AccountCreateSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .transform(sanitizeString),
  type: z.enum(["CASH", "BANK", "CREDIT", "SAVINGS", "OTHER"], {
    errorMap: () => ({ message: "Tipo de cuenta inválido" })
  }),
  currencyCode: z.string().length(3, "El código de moneda debe tener 3 caracteres"),
  initialBalance: z.number().int().optional().default(0)
});

export const AccountUpdateSchema = AccountCreateSchema.partial();

// Schema para categorías
export const CategoryCreateSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .transform(sanitizeString),
  type: z.enum(["INCOME", "EXPENSE"], {
    errorMap: () => ({ message: "Tipo debe ser INCOME o EXPENSE" })
  }),
  parentId: z.string().nullable().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color debe ser un código hex válido").optional()
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial();

// Schema para metas de ahorro
export const GoalCreateSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  savingGoalCents: z.number()
    .int("El monto debe ser un número entero")
    .min(0, "El monto no puede ser negativo")
    .max(999999999999, "El monto es demasiado grande")
});

// Schema para deudas
export const DebtCreateSchema = z.object({
  description: z.string()
    .min(1, "La descripción es requerida")
    .max(200, "La descripción no puede exceder 200 caracteres")
    .transform(sanitizeString),
  totalAmountCents: z.number()
    .int()
    .positive("El monto total debe ser positivo")
    .max(999999999999),
  monthlyPaymentCents: z.number()
    .int()
    .positive("El pago mensual debe ser positivo")
    .max(999999999999),
  totalInstallments: z.number()
    .int()
    .positive("El número de cuotas debe ser positivo")
    .max(360, "Máximo 360 cuotas (30 años)"),
  paidInstallments: z.number()
    .int()
    .min(0)
    .optional()
    .default(0),
  startMonth: z.string()
    .refine(val => !isNaN(Date.parse(val)), "Fecha inválida")
    .transform(val => new Date(val)),
  currencyCode: z.string().length(3).optional().default("UYU"),
  interestRate: z.number().min(0).max(100).optional(),
  categoryId: z.string().optional()
});

export const DebtUpdateSchema = DebtCreateSchema.partial();

// Schema para tags
export const TagCreateSchema = z.object({
  name: z.string()
    .min(1, "El nombre es requerido")
    .max(50, "El nombre no puede exceder 50 caracteres")
    .transform(sanitizeString),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

// Schema para presupuestos por categoría
export const BudgetCreateSchema = z.object({
  categoryId: z.string().min(1, "Categoría es requerida"),
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  budgetCents: z.number()
    .int()
    .positive("El presupuesto debe ser positivo")
    .max(999999999999)
});

// Schema para búsqueda
export const SearchQuerySchema = z.object({
  q: z.string().min(2, "El término de búsqueda debe tener al menos 2 caracteres").max(100),
  type: z.enum(["transactions", "categories", "accounts", "all"]).optional().default("all"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional()
});

// Schema para paginación
export const PaginationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
  pageSize: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("50"),
  from: z.string().optional(),
  to: z.string().optional()
});
