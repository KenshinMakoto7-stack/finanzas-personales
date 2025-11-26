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
  type: z.enum(["CASH","BANK","CREDIT","SAVINGS","OTHER"]),
  currencyCode: z.string().min(3).max(3)
});

export const CategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME","EXPENSE"]),
  parentId: z.preprocess(
    (val) => val === "" || val === undefined || val === null ? null : val,
    z.string().min(1).nullable().optional()
  ),
  icon: z.preprocess(
    (val) => val === "" || val === undefined || val === null ? null : val,
    z.string().nullable().optional()
  ),
  color: z.preprocess(
    (val) => val === "" || val === undefined || val === null ? null : val,
    z.string().nullable().optional()
  )
});

export const TransactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1), // OBLIGATORIO
  type: z.enum(["INCOME","EXPENSE","TRANSFER"]),
  amountCents: z.number().int().positive(), // Solo positivos, redondeados
  currencyCode: z.string().min(3).max(3).default("USD"),
  occurredAt: z.string(), // ISO
  description: z.preprocess(
    (val) => val === "" || val === undefined || val === null ? null : val,
    z.string().nullable().optional()
  ),
  isRecurring: z.boolean().optional().default(false),
  recurringRule: z.preprocess(
    (val) => val === "" || val === undefined || val === null ? null : val,
    z.string().nullable().optional()
  ),
  nextOccurrence: z.preprocess(
    (val) => val === "" || val === undefined || val === null ? null : val,
    z.string().nullable().optional()
  ),
  isPaid: z.boolean().optional().default(false),
  totalOccurrences: z.number().int().positive().nullable().optional(),
  remainingOccurrences: z.number().int().min(0).nullable().optional()
});

export const GoalSchema = z.object({
  year: z.number().int().min(1970).max(2100),
  month: z.number().int().min(1).max(12),
  savingGoalCents: z.number().int().min(0)
});

export const CategoryBudgetSchema = z.object({
  categoryId: z.string().min(1),
  month: z.string(), // ISO date string
  budgetCents: z.number().int().positive(),
  alertThreshold: z.number().int().min(0).max(100).default(80)
});

export const TagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().default("#667eea")
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type TransactionInput = z.infer<typeof TransactionSchema>;
export type CategoryBudgetInput = z.infer<typeof CategoryBudgetSchema>;
export type TagInput = z.infer<typeof TagSchema>;


