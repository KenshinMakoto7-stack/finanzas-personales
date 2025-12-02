import { Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { z } from "zod";
import { objectToFirestore, docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

const CategoryBudgetSchema = z.object({
  categoryId: z.string(),
  month: z.string(),
  budgetCents: z.number().int().positive(),
  alertThreshold: z.number().int().min(0).max(100).default(80)
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

    // Calcular gastos actuales por categoría
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget: any) => {
        const startOfMonth = budget.month instanceof Date ? budget.month : new Date(budget.month);
        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        // Obtener gastos del mes para esta categoría
        // Evitar índice compuesto: consultar solo por userId y occurredAt, filtrar categoryId y type en memoria
        const transactionsSnapshot = await db.collection("transactions")
          .where("userId", "==", userId)
          .where("occurredAt", ">=", Timestamp.fromDate(startOfMonth))
          .where("occurredAt", "<", Timestamp.fromDate(endOfMonth))
          .get();

        const expenses = transactionsSnapshot.docs
          .map(doc => docToObject(doc))
          .filter((tx: any) => tx.type === "EXPENSE" && tx.categoryId === budget.categoryId);

        const spentCents = expenses.reduce((sum: number, tx: any) => {
          return sum + (tx.amountCents || 0);
        }, 0);

        const percentage = budget.budgetCents > 0
          ? Math.round((spentCents / budget.budgetCents) * 100)
          : 0;
        const isAlert = percentage >= budget.alertThreshold;

        // Cargar categoría
        const categoryDoc = await db.collection("categories").doc(budget.categoryId).get();
        const category = categoryDoc.exists ? docToObject(categoryDoc) : null;

        return {
          ...budget,
          category,
          spentCents,
          percentage,
          isAlert,
          remainingCents: Math.max(0, budget.budgetCents - spentCents)
        };
      })
    );

    res.json({ budgets: budgetsWithSpent });
  } catch (error: any) {
    console.error("List category budgets error:", error);
    res.status(500).json({ error: error.message || "Error al listar presupuestos" });
  }
}

export async function createCategoryBudget(req: AuthRequest, res: Response) {
  try {
    const parsed = CategoryBudgetSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return res.status(400).json({ error: `Error de validación: ${errors}` });
    }

    const { categoryId, month, budgetCents, alertThreshold } = parsed.data;
    const userId = req.user!.userId;

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
      await db.collection("categoryBudgets").doc(existingSnapshot.docs[0].id).update({
        budgetCents,
        alertThreshold,
        updatedAt: Timestamp.now()
      });
      budget = docToObject(await db.collection("categoryBudgets").doc(existingSnapshot.docs[0].id).get());
    } else {
      // Crear nuevo
      const budgetData = {
        userId,
        categoryId,
        month: Timestamp.fromDate(monthDate),
        budgetCents,
        alertThreshold: alertThreshold || 80,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      const docRef = await db.collection("categoryBudgets").add(objectToFirestore(budgetData));
      budget = docToObject(await docRef.get());
    }

    // Cargar categoría
    const category = docToObject(categoryDoc);

    res.status(201).json({ budget: { ...budget, category } });
  } catch (error: any) {
    console.error("Create category budget error:", error);
    res.status(500).json({ error: error.message || "Error al crear presupuesto" });
  }
}

export async function updateCategoryBudget(req: AuthRequest, res: Response) {
  try {
    const { budgetCents, alertThreshold } = req.body;
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    // Verificar que el presupuesto existe y pertenece al usuario
    const budgetDoc = await db.collection("categoryBudgets").doc(budgetId).get();
    if (!budgetDoc.exists) {
      return res.status(404).json({ error: "Presupuesto no encontrado" });
    }

    const budgetData = budgetDoc.data()!;
    if (budgetData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const updateData: any = { updatedAt: Timestamp.now() };
    if (budgetCents !== undefined) updateData.budgetCents = Math.round(budgetCents);
    if (alertThreshold !== undefined) updateData.alertThreshold = alertThreshold;

    await db.collection("categoryBudgets").doc(budgetId).update(objectToFirestore(updateData));

    const updatedBudget = docToObject(await db.collection("categoryBudgets").doc(budgetId).get());
    
    // Cargar categoría
    const categoryDoc = await db.collection("categories").doc(updatedBudget.categoryId).get();
    const category = categoryDoc.exists ? docToObject(categoryDoc) : null;

    res.json({ budget: { ...updatedBudget, category } });
  } catch (error: any) {
    console.error("Update category budget error:", error);
    res.status(500).json({ error: error.message || "Error al actualizar presupuesto" });
  }
}

export async function deleteCategoryBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const budgetId = req.params.id;

    // Verificar que el presupuesto existe y pertenece al usuario
    const budgetDoc = await db.collection("categoryBudgets").doc(budgetId).get();
    if (!budgetDoc.exists) {
      return res.status(404).json({ error: "Presupuesto no encontrado" });
    }

    const budgetData = budgetDoc.data()!;
    if (budgetData.userId !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await db.collection("categoryBudgets").doc(budgetId).delete();
    res.status(204).send();
  } catch (error: any) {
    console.error("Delete category budget error:", error);
    res.status(500).json({ error: error.message || "Error al eliminar presupuesto" });
  }
}
