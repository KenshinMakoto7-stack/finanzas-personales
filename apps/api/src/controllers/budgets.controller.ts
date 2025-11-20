import { Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { z } from "zod";

const CategoryBudgetSchema = z.object({
  categoryId: z.string().cuid(),
  month: z.string(), // ISO date string (primer día del mes)
  budgetCents: z.number().int().positive(),
  alertThreshold: z.number().int().min(0).max(100).default(80)
});

export async function listCategoryBudgets(req: AuthRequest, res: Response) {
  const { month } = req.query;
  const userId = req.user!.userId;

  const where: any = { userId };
  if (month) {
    const monthDate = new Date(month as string);
    where.month = monthDate;
  }

  const budgets = await prisma.categoryBudget.findMany({
    where,
    include: {
      category: true
    },
    orderBy: { month: "desc" }
  });

  // Calcular gastos actuales por categoría
  const budgetsWithSpent = await Promise.all(
    budgets.map(async (budget) => {
      const startOfMonth = new Date(budget.month);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);

      const spent = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          type: "EXPENSE",
          occurredAt: {
            gte: startOfMonth,
            lt: endOfMonth
          }
        },
        _sum: {
          amountCents: true
        }
      });

      const spentCents = spent._sum.amountCents || 0;
      const percentage = budget.budgetCents > 0 
        ? Math.round((spentCents / budget.budgetCents) * 100) 
        : 0;
      const isAlert = percentage >= budget.alertThreshold;

      return {
        ...budget,
        spentCents,
        percentage,
        isAlert,
        remainingCents: Math.max(0, budget.budgetCents - spentCents)
      };
    })
  );

  res.json({ budgets: budgetsWithSpent });
}

export async function createCategoryBudget(req: AuthRequest, res: Response) {
  const parsed = CategoryBudgetSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }

  const { categoryId, month, budgetCents, alertThreshold } = parsed.data;
  const userId = req.user!.userId;

  // Verificar que la categoría pertenece al usuario
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId }
  });

  if (!category) {
    return res.status(404).json({ error: "Categoría no encontrada" });
  }

  // Normalizar el mes al primer día
  const monthDate = new Date(month);
  monthDate.setDate(1);
  monthDate.setHours(0, 0, 0, 0);

  const budget = await prisma.categoryBudget.upsert({
    where: {
      userId_categoryId_month: {
        userId,
        categoryId,
        month: monthDate
      }
    },
    update: {
      budgetCents,
      alertThreshold
    },
    create: {
      userId,
      categoryId,
      month: monthDate,
      budgetCents,
      alertThreshold
    },
    include: {
      category: true
    }
  });

  res.status(201).json({ budget });
}

export async function updateCategoryBudget(req: AuthRequest, res: Response) {
  const { budgetCents, alertThreshold } = req.body;
  const userId = req.user!.userId;
  const budgetId = req.params.id;

  const budget = await prisma.categoryBudget.update({
    where: { id: budgetId, userId },
    data: {
      ...(budgetCents !== undefined && { budgetCents: Math.round(budgetCents) }),
      ...(alertThreshold !== undefined && { alertThreshold })
    },
    include: {
      category: true
    }
  });

  res.json({ budget });
}

export async function deleteCategoryBudget(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const budgetId = req.params.id;

  await prisma.categoryBudget.delete({
    where: { id: budgetId, userId }
  });

  res.status(204).send();
}

