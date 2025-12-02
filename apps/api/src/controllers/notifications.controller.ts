import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { docToObject, getDocumentsByIds } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function registerSubscription(req: AuthRequest, res: Response) {
  try {
    const { endpoint, keys } = req.body;
    const userId = req.user!.userId;

    if (!endpoint || !keys) {
      return res.status(400).json({ error: "Endpoint y keys son requeridos" });
    }

    // Guardar suscripción en Firestore
    const subscriptionData = {
      userId,
      endpoint,
      keys,
      createdAt: Timestamp.now()
    };

    // Verificar si ya existe
    const existingSnapshot = await db.collection("notificationSubscriptions")
      .where("userId", "==", userId)
      .where("endpoint", "==", endpoint)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      await db.collection("notificationSubscriptions").doc(existingSnapshot.docs[0].id).update({
        keys,
        updatedAt: Timestamp.now()
      });
    } else {
      await db.collection("notificationSubscriptions").add(subscriptionData);
    }

    res.json({
      success: true,
      message: "Suscripción registrada correctamente"
    });
  } catch (error: any) {
    console.error("Error registering subscription:", error);
    res.status(500).json({ error: "Error al registrar suscripción" });
  }
}

export async function getPendingNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { date } = req.query;

    // Obtener usuario
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const targetDate = date ? new Date(date as string) : new Date();

    const notifications: any[] = [];

    // 1. Verificar transacciones recurrentes que deben ejecutarse hoy
    const tomorrow = new Date(targetDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const recurringSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .where("isRecurring", "==", true)
      .where("nextOccurrence", "<=", Timestamp.fromDate(tomorrow))
      .get();

    const recurringTransactions = recurringSnapshot.docs.map(doc => docToObject(doc));

    // Cargar relaciones
    const categoryIds = [...new Set(recurringTransactions.map((t: any) => t.categoryId).filter(Boolean))];
    const accountIds = [...new Set(recurringTransactions.map((t: any) => t.accountId))];

    const [categories, accounts] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));
    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));

    recurringTransactions.forEach((tx: any) => {
      if (tx.nextOccurrence) {
        const txDate = tx.nextOccurrence instanceof Date ? tx.nextOccurrence : new Date(tx.nextOccurrence);
        const today = new Date(targetDate);
        if (txDate.toDateString() === today.toDateString()) {
          const category = tx.categoryId ? categoriesMap.get(tx.categoryId) : null;
          notifications.push({
            type: "RECURRING_TRANSACTION",
            title: "Transacción Recurrente",
            message: `Recordatorio: ${tx.description || "Transacción"} - ${category?.name || ""}`,
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

    const budgetsSnapshot = await db.collection("categoryBudgets")
      .where("userId", "==", userId)
      .where("month", "==", Timestamp.fromDate(monthStart))
      .get();

    const budgets = budgetsSnapshot.docs.map(doc => docToObject(doc));

    // Cargar categorías
    const budgetCategoryIds = [...new Set(budgets.map((b: any) => b.categoryId))];
    const budgetCategories = await getDocumentsByIds("categories", budgetCategoryIds);

    const budgetCategoriesMap = new Map(budgetCategories.map((c: any) => [c.id, c]));

    // Obtener todas las transacciones del mes una sola vez para evitar múltiples consultas
    const allTransactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .get();
    
    const allTransactions = allTransactionsSnapshot.docs.map(doc => docToObject(doc));
    const monthStartTime = monthStart.getTime();
    const monthEndTime = monthEnd.getTime();

    for (const budget of budgets) {
      // Filtrar transacciones en memoria para evitar índices compuestos
      const expenses = allTransactions.filter((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        const txTime = txDate.getTime();
        return tx.type === "EXPENSE" 
          && tx.categoryId === budget.categoryId
          && txTime >= monthStartTime 
          && txTime <= monthEndTime;
      });

      const spentCents = expenses.reduce((sum: number, tx: any) => {
        return sum + (tx.amountCents || 0);
      }, 0);

      const percentage = budget.budgetCents > 0
        ? Math.round((spentCents / budget.budgetCents) * 100)
        : 0;

      const category = budgetCategoriesMap.get(budget.categoryId);

      if (percentage >= budget.alertThreshold && percentage < 100) {
        notifications.push({
          type: "BUDGET_ALERT",
          title: "Alerta de Presupuesto",
          message: `Has alcanzado el ${percentage}% del presupuesto de ${category?.name || "Categoría"}`,
          data: { budgetId: budget.id, categoryId: budget.categoryId },
          priority: percentage >= 90 ? "high" : "normal"
        });
      } else if (percentage >= 100) {
        notifications.push({
          type: "BUDGET_EXCEEDED",
          title: "Presupuesto Excedido",
          message: `Has excedido el presupuesto de ${category?.name || "Categoría"}`,
          data: { budgetId: budget.id, categoryId: budget.categoryId },
          priority: "high"
        });
      }
    }

    // 3. Verificar metas de ahorro
    const goalSnapshot = await db.collection("monthlyGoals")
      .where("userId", "==", userId)
      .where("month", "==", Timestamp.fromDate(monthStart))
      .limit(1)
      .get();

    if (!goalSnapshot.empty) {
      const goal = docToObject(goalSnapshot.docs[0]);

      // Usar las transacciones ya obtenidas anteriormente para evitar índices compuestos
      // Filtrar en memoria las transacciones del mes
      const transactions = allTransactions.filter((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        const txTime = txDate.getTime();
        return txTime >= monthStartTime && txTime <= monthEndTime;
      });

      const totalIncome = transactions
        .filter((t: any) => t.type === "INCOME")
        .reduce((sum, t: any) => sum + t.amountCents, 0);
      const totalExpenses = transactions
        .filter((t: any) => t.type === "EXPENSE")
        .reduce((sum, t: any) => sum + t.amountCents, 0);

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

export async function markAsRead(req: AuthRequest, res: Response) {
  // En una implementación real, guardarías esto en la base de datos
  res.json({ success: true });
}
