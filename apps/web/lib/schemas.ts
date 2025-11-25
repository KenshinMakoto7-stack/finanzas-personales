import { z } from "zod";

// Schema para login
export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// Schema para registro
export const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  name: z.string().min(2, "Mínimo 2 caracteres").optional(),
  currencyCode: z.string().length(3, "Debe ser código de 3 letras").default("UYU"),
  timeZone: z.string().default("America/Montevideo"),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

// Schema para transacción
export const TransactionSchema = z.object({
  accountId: z.string().min(1, "Selecciona una cuenta"),
  categoryId: z.string().optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"], { 
    errorMap: () => ({ message: "Selecciona un tipo" }) 
  }),
  amount: z.string()
    .min(1, "Ingresa un monto")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Monto debe ser mayor a 0"),
  currencyCode: z.string().length(3).default("UYU"),
  occurredAt: z.string().min(1, "Selecciona una fecha"),
  description: z.string().max(500, "Máximo 500 caracteres").optional(),
});
export type TransactionInput = z.infer<typeof TransactionSchema>;

// Schema para cuenta
export const AccountSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100, "Máximo 100 caracteres"),
  type: z.enum(["CASH", "BANK", "CREDIT", "SAVINGS", "OTHER"], {
    errorMap: () => ({ message: "Selecciona un tipo" })
  }),
  currencyCode: z.string().length(3, "Código de 3 letras").default("UYU"),
});
export type AccountInput = z.infer<typeof AccountSchema>;

// Schema para categoría
export const CategorySchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100, "Máximo 100 caracteres"),
  type: z.enum(["INCOME", "EXPENSE"], {
    errorMap: () => ({ message: "Selecciona un tipo" })
  }),
  parentId: z.string().optional(),
});
export type CategoryInput = z.infer<typeof CategorySchema>;

// Schema para meta de ahorro
export const GoalSchema = z.object({
  savingGoalCents: z.string()
    .min(1, "Ingresa una meta")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Meta debe ser positiva"),
});
export type GoalInput = z.infer<typeof GoalSchema>;

// Schema para deuda
export const DebtSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100, "Máximo 100 caracteres"),
  totalAmountCents: z.string()
    .min(1, "Ingresa el monto total")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Monto debe ser mayor a 0"),
  totalInstallments: z.string()
    .min(1, "Ingresa el número de cuotas")
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) > 0, "Debe ser mayor a 0"),
  interestRate: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), "Tasa inválida"),
  startDate: z.string().min(1, "Selecciona fecha de inicio"),
});
export type DebtInput = z.infer<typeof DebtSchema>;

