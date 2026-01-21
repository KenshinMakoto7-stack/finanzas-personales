import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { z } from "zod";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";
import { touchUserData } from "../lib/cache.js";

const CategoryBudgetSchema = z.object({
  categoryId: z.string(),
  month: z.string(),
  budgetCents: z.number().int().positive(),
  // Soporte para formato antiguo (un solo umbral) y nuevo (array de hasta 5)
  alertThreshold: z.number().int().min(0).max(100).optional(), // Deprecated, mantener para migración
  alertThresholds: z.array(z.number().int().min(0).max(100)).max(5).optional(), // Nuevo formato: array de hasta 5 umbrales
  triggeredThresholds: z.array(z.number().int().min(0).max(100)).optional() // Umbrales ya disparados este mes
});

export async function listCategoryBudgets(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query;
    const userId = req.user!.userId;

    let query: FirebaseFirestore.Query = db.collection("categoryBudgets")
      .where("userId", "==", userId);

    if (month) {
      const monthDate = new Date(month as string);
      monthDate.setDate(1);
      monthDate.setHours(0, 0, 0, 0);
      query = query.where("month", "==", Timestamp.fromDate(monthDate));
    }

    // No usar orderBy para evitar índice compuesto
    const snapshot = await query.get();
    
    // Ordenar en memoria
    const budgets = snapshot.docs
      .map(doc => docToObject(doc))
      .sort((a: any, b: any) => {
        const dateA = a.month ? new Date(a.month).getTime() : 0;
        const dateB = b.month ? new Date(b.month).getTime() : 0;
        return dateB - dateA; // desc
      });

    // Obtener todas las transacciones del usuario una sola vez para evitar múltiples consultas
    // Esto evita problemas de índices compuestos
    const allTransactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .get();
    
    const allTransactions = allTransactionsSnapshot.docs.map(doc => docToObject(doc));

    // Calcular gastos actuales por categoría
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget: any) => {
        const startOfMonth = budget.month instanceof Date ? budget.month : new Date(budget.month);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        
        const startTime = startOfMonth.getTime();
        const endTime = endOfMonth.getTime();

        // Filtrar transacciones en memoria para evitar índices compuestos
        const expenses = allTransactions.filter((tx: any) => {
          const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
          const txTime = txDate.getTime();
          return tx.type === "EXPENSE" 
            && tx.categoryId === budget.categoryId
            && txTime >= startTime 
            && txTime < endTime;
        });

        const spentCents = expenses.reduce((sum: number, tx: any) => {
          return sum + (tx.amountCents || 0);
        }, 0);

        const percentage = budget.budgetCents > 0
          ? Math.round((spentCents / budget.budgetCents) * 100)
          : 0;
        
        // Normalizar alertThresholds: si viene alertThreshold antiguo, convertirlo a array
        let alertThresholds: number[] = [];
        if (budget.alertThresholds && Array.isArray(budget.alertThresholds)) {
          alertThresholds = budget.alertThresholds.sort((a, b) => a - b); // Ordenar ascendente
        } else if (budget.alertThreshold !== undefined) {
          // Migración automática: convertir alertThreshold antiguo a array
          alertThresholds = [budget.alertThreshold];
        }
        
        // Determinar qué umbrales se han alcanzado
        const triggeredThresholds = budget.triggeredThresholds || [];
        const reachedThresholds = alertThresholds.filter(threshold => percentage >= threshold);
        const newThresholds = reachedThresholds.filter(t => !triggeredThresholds.includes(t));
        const hasActiveAlert = newThresholds.length > 0 || percentage >= 100;

        // Cargar categoría
        const categoryDoc = await db.collection("categories").doc(budget.categoryId).get();
        const category = categoryDoc.exists ? docToObject(categoryDoc) : null;

        return {
          ...budget,
          category,
          spentCents,
          percentage,
          isAlert: hasActiveAlert,
          hasActiveAlert,
          alertThresholds, // Siempre devolver como array
          reachedThresholds,
          newThresholds,
          remainingCents: Math.max(0, budget.budgetCents - spentCents)
        };
      })
    );

    res.json({ budgets: budgetsWithSpent });
  } catch (error: any) {
    console.error("List category budgets error:", error);
    res.status(500).json({ error: error.message || "Error al listar límites" });
  }
}

// Nuevo endpoint: obtener solo límites con alertas activas (para dashboard)
export async function getActiveLimitAlerts(req: AuthRequest, res: Response) {
  try {
    const { month } = req.query;
    const userId = req.user!.userId;
    const today = new Date();
    const targetMonth = month ? new Date(month as string) : today;
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthStartTimestamp = Timestamp.fromDate(monthStart);

    // Obtener límites del mes
    const budgetsSnapshot = await db.collection("categoryBudgets")
      .where("userId", "==", userId)
      .where("month", "==", monthStartTimestamp)
      .get();

    const budgets = budgetsSnapshot.docs.map(doc => docToObject(doc));
    
    if (budgets.length === 0) {
      return res.json({ alerts: [] });
    }

    // Obtener transacciones del mes
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthEndTimestamp = Timestamp.fromDate(monthEnd);
    
    const monthTransactionsSnapshot = await db.collection("transactions")
      .where("userId", "==", userId)
      .where("type", "==", "EXPENSE")
      .where("occurredAt", ">=", monthStartTimestamp)
      .where("occurredAt", "<=", monthEndTimestamp)
      .limit(500)
      .get();
    
    const monthTransactions = monthTransactionsSnapshot.docs.map(doc => docToObject(doc));

    // Cargar categorías
    const categoryIds = [...new Set(budgets.map((b: any) => b.categoryId))];
    const categories = await Promise.all(
      categoryIds.map(id => db.collection("categories").doc(id).get())
    );
    const categoriesMap = new Map(
      categories
        .filter(doc => doc.exists)
        .map(doc => [doc.id, docToObject(doc)])
    );

    const activeAlerts: any[] = [];

    for (const budget of budgets) {
      // Normalizar alertThresholds
      let alertThresholds: number[] = [];
      if (budget.alertThresholds && Array.isArray(budget.alertThresholds)) {
        alertThresholds = budget.alertThresholds.sort((a, b) => a - b);
      } else if (budget.alertThreshold !== undefined) {
        alertThresholds = [budget.alertThreshold];
      } else {
        continue; // Sin umbrales configurados
      }

      // Filtrar transacciones del mes por categoría
      const expenses = monthTransactions.filter((tx: any) => {
        return tx.categoryId === budget.categoryId;
      });

      const spentCents = expenses.reduce((sum: number, tx: any) => {
        return sum + (tx.amountCents || 0);
      }, 0);

      const percentage = budget.budgetCents > 0
        ? Math.round((spentCents / budget.budgetCents) * 100)
        : 0;

      // Determinar qué umbrales se han alcanzado pero no se han disparado aún
      const triggeredThresholds = budget.triggeredThresholds || [];
      const reachedThresholds = alertThresholds.filter(threshold => percentage >= threshold);
      const newThresholds = reachedThresholds.filter(t => !triggeredThresholds.includes(t));

      // Solo incluir si hay una alerta activa (umbral nuevo alcanzado o excedido)
      if (newThresholds.length > 0 || percentage >= 100) {
        const category = categoriesMap.get(budget.categoryId);
        activeAlerts.push({
          limitId: budget.id,
          categoryId: budget.categoryId,
          categoryName: category?.name || "Categoría desconocida",
          limitCents: budget.budgetCents,
          spentCents,
          percentage,
          remainingCents: Math.max(0, budget.budgetCents - spentCents),
          remainingPercentage: Math.max(0, 100 - percentage),
          newThresholds, // Umbrales recién alcanzados
          isExceeded: percentage >= 100
        });
      }
    }

    res.json({ alerts: activeAlerts });
  } catch (error: any) {
    console.error("Get active limit alerts error:", error);
    res.status(500).json({ error: error.message || "Error al obtener alertas activas" });
  }
}

export async function createCategoryBudget(req: AuthRequest, res: Response) {
  try {
    const parsed = CategoryBudgetSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { categoryId, month, budgetCents, alertThreshold, alertThresholds } = parsed.data;
    const userId = req.user!.userId;
    
    // Normalizar alertThresholds: convertir alertThreshold antiguo a array si es necesario
    let normalizedThresholds: number[] = [];
    if (alertThresholds && Array.isArray(alertThresholds) && alertThresholds.length > 0) {
      // Validar y ordenar umbrales
      normalizedThresholds = alertThresholds
        .filter((t: number) => t >= 0 && t <= 100)
        .sort((a, b) => a - b)
        .slice(0, 5); // Máximo 5 umbrales
    } else if (alertThreshold !== undefined) {
      // Migración: convertir alertThreshold antiguo a array
      normalizedThresholds = [alertThreshold];
    } else {
      // Por defecto: 80%
      normalizedThresholds = [80];
    }

    // Verificar que la categoría pertenece al usuario
    const categoryDoc = await db.collection("categories").doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const categoryData = categoryDoc.data()!;
    if (categoryData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Normalizar el mes al primer día
    const monthDate = new Date(month);
    monthDate.setDate(1);
    monthDate.setHours(0, 0, 0, 0);

    // Buscar presupuesto existente
    const existingSnapshot = await db.collection("categoryBudgets")
      .where("userId", "==", userId)
      .where("categoryId", "==", categoryId)
      .where("month", "==", Timestamp.fromDate(monthDate))
      .limit(1)
      .get();

    let budget;
    if (!existingSnapshot.empty) {
      // Actualizar existente
      const existingBudget = docToObject(existingSnapshot.docs[0]);
      // Preservar triggeredThresholds existentes si no se resetea el mes
      const existingMonth = existingBudget.month instanceof Date 
        ? existingBudget.month 
        : new Date(existingBudget.month);
      const isSameMonth = existingMonth.getTime() === monthDate.getTime();
      
      const updateData: any = {
        budgetCents,
        alertThresholds: normalizedThresholds,
        updatedAt: Timestamp.now()
      };
      
      // Si cambia de mes, resetear triggeredThresholds
      if (!isSameMonth) {
        updateData.triggeredThresholds = [];
      } else if (existingBudget.triggeredThresholds) {
        updateData.triggeredThresholds = existingBudget.triggeredThresholds;
      }
      
      await db.collection("categoryBudgets").doc(existingSnapshot.docs[0].id).update(objectToFirestore(updateData));
      budget = docToObject(await db.collection("categoryBudgets").doc(existingSnapshot.docs[0].id).get());
    } else {
      // Crear nuevo
      const budgetData = {
        userId,
        categoryId,
        month: Timestamp.fromDate(monthDate),
        budgetCents,
        alertThresholds: normalizedThresholds,
        triggeredThresholds: [], // Inicializar vacío
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      const docRef = await db.collection("categoryBudgets").add(objectToFirestore(budgetData));
      budget = docToObject(await docRef.get());
    }

    void touchUserData(userId);
    // Cargar categoría
    const category = docToObject(categoryDoc);

    res.status(201).json({ budget: { ...budget, category } });
  } catch (error: any) {
    console.error("Create category budget error:", error);
    res.status(500).json({ error: error.message || "Error al crear límite" });
  }
}

export async function updateCategoryBudget(req: AuthRequest, res: Response) {
  try {
    const { budgetCents, alertThreshold, alertThresholds } = req.body;
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    // Verificar que el presupuesto existe y pertenece al usuario
    const budgetDoc = await db.collection("categoryBudgets").doc(budgetId).get();
    if (!budgetDoc.exists) {
      return res.status(404).json({ error: "Límite no encontrado" });
    }

    const budgetData = budgetDoc.data()!;
    if (budgetData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updateData: any = { updatedAt: Timestamp.now() };
    if (budgetCents !== undefined) updateData.budgetCents = Math.round(budgetCents);
    
    // Normalizar alertThresholds
    if (alertThresholds !== undefined && Array.isArray(alertThresholds)) {
      const normalized = alertThresholds
        .filter((t: number) => t >= 0 && t <= 100)
        .sort((a, b) => a - b)
        .slice(0, 5);
      updateData.alertThresholds = normalized;
    } else if (alertThreshold !== undefined) {
      // Migración: convertir alertThreshold antiguo a array
      updateData.alertThresholds = [alertThreshold];
    }

    await db.collection("categoryBudgets").doc(budgetId).update(objectToFirestore(updateData));
    void touchUserData(userId);

    const updatedBudget = docToObject(await db.collection("categoryBudgets").doc(budgetId).get());
    
    // Cargar categoría
    const categoryDoc = await db.collection("categories").doc(updatedBudget.categoryId).get();
    const category = categoryDoc.exists ? docToObject(categoryDoc) : null;

    res.json({ budget: { ...updatedBudget, category } });
  } catch (error: any) {
    console.error("Update category budget error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar límite" });
  }
}

export async function deleteCategoryBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    // Verificar que el límite existe y pertenece al usuario
    const budgetDoc = await db.collection("categoryBudgets").doc(budgetId).get();
    if (!budgetDoc.exists) {
      return res.status(404).json({ error: "Límite no encontrado" });
    }

    const budgetData = budgetDoc.data()!;
    if (budgetData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db.collection("categoryBudgets").doc(budgetId).delete();
    void touchUserData(req.user!.userId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Delete category budget error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar límite" });
  }
}

// Endpoint temporal para ejecutar migración
export async function migrateBudgetsToLimitsEndpoint(req: AuthRequest, res: Response) {
  try {
    console.log("🔄 Iniciando migración de presupuestos a límites...");
    const migrateFn = await import("../scripts/migrate-budgets-to-limits.js");
    await migrateFn.migrateBudgetsToLimits();
    res.json({ 
      success: true, 
      message: "Migración completada exitosamente" 
    });
  } catch (error: any) {
    console.error("❌ Error en migración:", error);
    res.status(500).json({ 
      error: error.message || "Error al ejecutar migración" 
    });
  }
}
