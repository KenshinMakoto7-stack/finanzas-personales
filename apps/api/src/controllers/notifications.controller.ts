import { Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";

// Registrar subscription para notificaciones push
export async function registerSubscription(req: AuthRequest, res: Response) {
  const { endpoint, keys } = req.body;
  const userId = req.user!.userId;

  if (!endpoint || !keys) {
    return res.status(400).json({ error: "Endpoint y keys son requeridos" });
  }

  try {
    // En una implementación real, guardarías esto en la base de datos
    // Por ahora, solo confirmamos que se recibió
    // TODO: Crear modelo PushSubscription en Prisma
    
    res.json({ 
      success: true, 
      message: "Suscripción registrada correctamente" 
    });
  } catch (error: any) {
    console.error("Error registering subscription:", error);
    res.status(500).json({ error: "Error al registrar suscripción" });
  }
}

// Obtener notificaciones pendientes para el usuario
export async function getPendingNotifications(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { date } = req.query;

  try {
    const targetDate = date ? new Date(date as string) : new Date();
    
    const notifications: any[] = [];

    // 1. Verificar transacciones recurrentes que deben ejecutarse hoy
    const recurringTransactions = await prisma.transaction.findMany({
      where: {
        userId,
        isRecurring: true,
        nextOccurrence: {
          lte: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) // Próximas 24 horas
        }
      },
      include: {
        category: true,
        account: true
      }
    });

    recurringTransactions.forEach(tx => {
      if (tx.nextOccurrence) {
        const txDate = new Date(tx.nextOccurrence);
        const today = new Date(targetDate);
        if (txDate.toDateString() === today.toDateString()) {
          notifications.push({
            type: "RECURRING_TRANSACTION",
            title: "Transacción Recurrente",
            message: `Recordatorio: ${tx.description || "Transacción"} - ${tx.category?.name || ""}`,
            data: { transactionId: tx.id },
            priority: "high"
          });
        }
      }
    });

    // 2. Verificar alertas de presupuesto
    const [year, month] = [targetDate.getFullYear(), targetDate.getMonth() + 1];
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const budgets = await prisma.categoryBudget.findMany({
      where: {
        userId,
        month: monthStart
      },
      include: {
        category: true
      }
    });

    for (const budget of budgets) {
      const spent = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          type: "EXPENSE",
          occurredAt: {
            gte: monthStart,
            lte: monthEnd
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

      if (percentage >= budget.alertThreshold && percentage < 100) {
        notifications.push({
          type: "BUDGET_ALERT",
          title: "Alerta de Presupuesto",
          message: `Has alcanzado el ${percentage}% del presupuesto de ${budget.category.name}`,
          data: { budgetId: budget.id, categoryId: budget.categoryId },
          priority: percentage >= 90 ? "high" : "normal"
        });
      } else if (percentage >= 100) {
        notifications.push({
          type: "BUDGET_EXCEEDED",
          title: "Presupuesto Excedido",
          message: `Has excedido el presupuesto de ${budget.category.name}`,
          data: { budgetId: budget.id, categoryId: budget.categoryId },
          priority: "high"
        });
      }
    }

    // 3. Verificar metas de ahorro
    const goal = await prisma.monthlyGoal.findFirst({
      where: {
        userId,
        month: monthStart
      }
    });

    if (goal) {
      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          occurredAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });

      const totalIncome = transactions
        .filter(t => t.type === "INCOME")
        .reduce((sum, t) => sum + t.amountCents, 0);
      const totalExpenses = transactions
        .filter(t => t.type === "EXPENSE")
        .reduce((sum, t) => sum + t.amountCents, 0);
      
      const saved = totalIncome - totalExpenses;
      const progress = goal.savingGoalCents > 0 
        ? Math.round((saved / goal.savingGoalCents) * 100) 
        : 0;

      if (progress >= 100) {
        notifications.push({
          type: "GOAL_ACHIEVED",
          title: "¡Meta Alcanzada! 🎉",
          message: `Has alcanzado tu meta de ahorro del mes`,
          data: { goalId: goal.id },
          priority: "high"
        });
      } else if (progress >= 75 && progress < 100) {
        notifications.push({
          type: "GOAL_PROGRESS",
          title: "Progreso en Meta",
          message: `Llevas el ${progress}% de tu meta de ahorro`,
          data: { goalId: goal.id },
          priority: "normal"
        });
      }
    }

    res.json({ notifications });
  } catch (error: any) {
    console.error("Error getting notifications:", error);
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
}

// Marcar notificación como leída
export async function markAsRead(req: AuthRequest, res: Response) {
  // En una implementación real, guardarías esto en la base de datos
  res.json({ success: true });
}

