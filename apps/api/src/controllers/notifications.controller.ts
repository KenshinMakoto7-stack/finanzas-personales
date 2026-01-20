import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { docToObject, getDocumentsByIds, fromFirestoreTimestamp } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";
import { getVapidPublicKey, isPushConfigured, sendPushNotification } from "../services/push.service.js";

// Cache simple en memoria para notificaciones (TTL: 2 minutos)
interface CacheEntry {
  notifications: any[];
  timestamp: number;
}

const notificationsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

async function computeNotifications(userId: string, date?: string) {
  const targetDate = date ? new Date(date) : new Date();
  const notifications: any[] = [];

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return notifications;
  }

  const userData = userDoc.data()!;
  const tz = userData.timeZone || "UTC";

  const tomorrow = new Date(targetDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  const tomorrowTimestamp = Timestamp.fromDate(tomorrow);

  const recurringSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("isRecurring", "==", true)
    .where("nextOccurrence", "<=", tomorrowTimestamp)
    .limit(100)
    .get();
  
  const recurringTransactions = recurringSnapshot.docs.map(doc => docToObject(doc));

  const categoryIds = [...new Set(recurringTransactions.map((t: any) => t.categoryId).filter(Boolean))];
  const categories = await getDocumentsByIds("categories", categoryIds);

  const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));

  recurringTransactions.forEach((tx: any) => {
    if (tx.nextOccurrence) {
      try {
        const txDate = fromFirestoreTimestamp(tx.nextOccurrence) || 
                      (tx.nextOccurrence instanceof Date ? tx.nextOccurrence : null) ||
                      (typeof tx.nextOccurrence === "string" || typeof tx.nextOccurrence === "number" ? new Date(tx.nextOccurrence) : null);
        
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
      }
    }
  });

  const [year, month] = [targetDate.getFullYear(), targetDate.getMonth() + 1];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const budgetsSnapshot = await db.collection("categoryBudgets")
    .where("userId", "==", userId)
    .where("month", "==", Timestamp.fromDate(monthStart))
    .get();

  const budgets = budgetsSnapshot.docs.map(doc => docToObject(doc));

  const budgetCategoryIds = [...new Set(budgets.map((b: any) => b.categoryId))];
  const budgetCategories = await getDocumentsByIds("categories", budgetCategoryIds);
  const budgetCategoriesMap = new Map(budgetCategories.map((c: any) => [c.id, c]));

  const monthEndDate = new Date(monthEnd);
  monthEndDate.setHours(23, 59, 59, 999);
  const monthEndTimestamp = Timestamp.fromDate(monthEndDate);

  const monthTransactionsSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("occurredAt", ">=", Timestamp.fromDate(monthStart))
    .where("occurredAt", "<=", monthEndTimestamp)
    .limit(500)
    .get();
  
  const monthTransactions = monthTransactionsSnapshot.docs.map(doc => docToObject(doc));

  const batch = db.batch();
  let hasUpdates = false;

  for (const budget of budgets) {
    const expenses = monthTransactions.filter((tx: any) => {
      return tx.type === "EXPENSE" && tx.categoryId === budget.categoryId;
    });

    const spentCents = expenses.reduce((sum: number, tx: any) => {
      return sum + (tx.amountCents || 0);
    }, 0);

    const percentage = budget.budgetCents > 0
      ? Math.round((spentCents / budget.budgetCents) * 100)
      : 0;

    let alertThresholds: number[] = [];
    if (budget.alertThresholds && Array.isArray(budget.alertThresholds)) {
      alertThresholds = budget.alertThresholds.sort((a, b) => a - b);
    } else if (budget.alertThreshold !== undefined) {
      alertThresholds = [budget.alertThreshold];
    }

    if (alertThresholds.length === 0) continue;

    const category = budgetCategoriesMap.get(budget.categoryId);
    const triggeredThresholds = budget.triggeredThresholds || [];
    const reachedThresholds = alertThresholds.filter(threshold => percentage >= threshold);
    const newThresholds = reachedThresholds.filter(t => !triggeredThresholds.includes(t));

    if (newThresholds.length > 0) {
      const highestNewThreshold = Math.max(...newThresholds);
      notifications.push({
        type: "LIMIT_ALERT",
        title: "Alerta de Límite",
        message: `Has alcanzado el ${highestNewThreshold}% del límite de ${category?.name || "Categoría"}`,
        data: { limitId: budget.id, categoryId: budget.categoryId, threshold: highestNewThreshold },
        priority: highestNewThreshold >= 90 ? "high" : "normal"
      });

      const budgetRef = db.collection("categoryBudgets").doc(budget.id);
      batch.update(budgetRef, {
        triggeredThresholds: reachedThresholds,
        updatedAt: Timestamp.now()
      });
      hasUpdates = true;
    } else if (percentage >= 100 && !triggeredThresholds.includes(100)) {
      notifications.push({
        type: "LIMIT_EXCEEDED",
        title: "Límite Excedido",
        message: `Has excedido el límite de ${category?.name || "Categoría"}`,
        data: { limitId: budget.id, categoryId: budget.categoryId },
        priority: "high"
      });

      const budgetRef = db.collection("categoryBudgets").doc(budget.id);
      batch.update(budgetRef, {
        triggeredThresholds: [...reachedThresholds, 100],
        updatedAt: Timestamp.now()
      });
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await batch.commit();
  }

  const goalSnapshot = await db.collection("monthlyGoals")
    .where("userId", "==", userId)
    .where("month", "==", Timestamp.fromDate(monthStart))
    .limit(1)
    .get();

  if (!goalSnapshot.empty) {
    const goal = docToObject(goalSnapshot.docs[0]);
    const totalIncome = monthTransactions
      .filter((t: any) => t.type === "INCOME")
      .reduce((sum, t: any) => sum + (t.amountCents || 0), 0);
    const totalExpenses = monthTransactions
      .filter((t: any) => t.type === "EXPENSE")
      .reduce((sum, t: any) => sum + (t.amountCents || 0), 0);

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

  const budgetSummary = await getBudgetSummaryForDate(userId, targetDate.toISOString().slice(0, 10), tz);
  if (budgetSummary.data?.safety?.overspend) {
    notifications.push({
      type: "BUDGET_OVERSEND",
      title: "Presupuesto Excedido",
      message: "Has gastado por encima del disponible del mes.",
      data: {},
      priority: "high"
    });
  }

  return notifications;
}

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

export async function getVapidPublicKeyEndpoint(req: AuthRequest, res: Response) {
  if (!isPushConfigured()) {
    return res.status(404).json({ error: "VAPID no configurado" });
  }
  res.json({ publicKey: getVapidPublicKey() });
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

    const notifications = await computeNotifications(userId, date as string | undefined);

    notificationsCache.set(cacheKey, { notifications, timestamp: now });
    for (const [key, entry] of notificationsCache.entries()) {
      if (now - entry.timestamp > 5 * 60 * 1000) {
        notificationsCache.delete(key);
      }
    }

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

export async function pushPendingNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    if (!isPushConfigured()) {
      return res.status(400).json({ error: "VAPID no configurado" });
    }

    const { date } = req.query;
    const notifications = await computeNotifications(userId, date as string | undefined);
    const limitedNotifications = notifications.slice(0, 3);

    const subscriptionsSnapshot = await db.collection("notificationSubscriptions")
      .where("userId", "==", userId)
      .get();

    const deletions: Promise<any>[] = [];
    await Promise.all(subscriptionsSnapshot.docs.map(async (doc) => {
      const sub = doc.data();
      for (const notification of limitedNotifications) {
        const result = await sendPushNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          notification
        );
        if (result.shouldRemove) {
          deletions.push(db.collection("notificationSubscriptions").doc(doc.id).delete());
        }
      }
    }));

    if (deletions.length > 0) {
      await Promise.all(deletions);
    }

    res.json({ sent: limitedNotifications.length });
  } catch (error: any) {
    console.error("Error sending push notifications:", error);
    res.status(500).json({ error: "Error al enviar notificaciones push" });
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
