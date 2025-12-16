import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { docToObject, getDocumentsByIds, fromFirestoreTimestamp } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

// Cache simple en memoria para notificaciones (TTL: 2 minutos)
interface CacheEntry {
  notifications: any[];
  timestamp: number;
}

const notificationsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

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

    // Verificar cache
    const cacheKey = `${userId}-${date || 'today'}`;
    const cached = notificationsCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return res.json({ notifications: cached.notifications });
    }

    // Obtener usuario
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const targetDate = date ? new Date(date as string) : new Date();

    const notifications: any[] = [];

    // OPTIMIZACIÓN: Cargar todas las transacciones UNA SOLA VEZ y reutilizarlas
    const allTransactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .get();
    
    const allTransactions = allTransactionsSnapshot.docs.map(doc => docToObject(doc));

    // 1. Verificar transacciones recurrentes que deben ejecutarse hoy
    const tomorrow = new Date(targetDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimestamp = Timestamp.fromDate(tomorrow);

    // Filtrar en memoria: transacciones recurrentes con nextOccurrence <= tomorrow
    const recurringTransactions = allTransactions.filter((tx: any) => {
      return tx.isRecurring === true && 
             tx.nextOccurrence && 
             (tx.nextOccurrence instanceof Timestamp 
               ? tx.nextOccurrence <= tomorrowTimestamp 
               : new Date(tx.nextOccurrence).getTime() <= tomorrow.getTime());
    });

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
        try {
          // Usar la función helper para convertir correctamente
          const txDate = fromFirestoreTimestamp(tx.nextOccurrence) || 
                        (tx.nextOccurrence instanceof Date ? tx.nextOccurrence : null) ||
                        (typeof tx.nextOccurrence === 'string' || typeof tx.nextOccurrence === 'number' ? new Date(tx.nextOccurrence) : null);
          
          if (txDate && !isNaN(txDate.getTime())) {
            const today = new Date(targetDate);
            today.setHours(0, 0, 0, 0);
            txDate.setHours(0, 0, 0, 0);
            if (txDate.getTime() === today.getTime()) {
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
        } catch (error) {
          console.error("Error procesando transacción recurrente:", error, tx.id);
          // Continuar con la siguiente transacción
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

    // OPTIMIZACIÓN: Reutilizar allTransactions ya cargadas anteriormente
    const monthStartTime = monthStart.getTime();
    const monthEndTime = monthEnd.getTime();

    for (const budget of budgets) {
      // Filtrar transacciones en memoria para evitar índices compuestos
      const expenses = allTransactions.filter((tx: any) => {
        try {
          if (!tx.occurredAt) return false;
          // Usar la función helper para convertir correctamente
          const txDate = fromFirestoreTimestamp(tx.occurredAt) || 
                        (tx.occurredAt instanceof Date ? tx.occurredAt : null) ||
                        (typeof tx.occurredAt === 'string' || typeof tx.occurredAt === 'number' ? new Date(tx.occurredAt) : null);
          
          if (!txDate || isNaN(txDate.getTime())) return false;
          const txTime = txDate.getTime();
          return tx.type === "EXPENSE" 
            && tx.categoryId === budget.categoryId
            && txTime >= monthStartTime 
            && txTime <= monthEndTime;
        } catch (error) {
          console.error("Error procesando transacción para presupuesto:", error, tx.id);
          return false;
        }
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

    // Guardar en cache
    notificationsCache.set(cacheKey, {
      notifications,
      timestamp: now
    });

    // Limpiar cache antiguo (más de 5 minutos)
    for (const [key, entry] of notificationsCache.entries()) {
      if (now - entry.timestamp > 5 * 60 * 1000) {
        notificationsCache.delete(key);
      }
    }

    // Agregar headers de cache HTTP (1 minuto)
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', `"${cacheKey}-${now}"`);
    
    res.json({ notifications });
  } catch (error: any) {
    console.error("Error getting notifications:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      userId: req.user?.userId
    });
    res.status(500).json({ 
      error: "Error al obtener notificaciones",
      details: process.env.NODE_ENV === "development" ? error?.message : undefined
    });
  }
}

export async function markAsRead(req: AuthRequest, res: Response) {
  try {
    const { notificationId } = req.body;
    // Por ahora, solo retornamos éxito ya que las notificaciones se generan dinámicamente
    // En el futuro, podríamos guardar el estado en Firestore
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Error al marcar notificación como leída" });
  }
}

export async function deleteNotification(req: AuthRequest, res: Response) {
  try {
    // Las notificaciones se generan dinámicamente, así que solo retornamos éxito
    // En el futuro, podríamos guardar notificaciones persistentes en Firestore
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Error al eliminar notificación" });
  }
}

export async function deleteAllNotifications(req: AuthRequest, res: Response) {
  try {
    // Las notificaciones se generan dinámicamente, así que solo retornamos éxito
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({ error: "Error al eliminar todas las notificaciones" });
  }
}
