import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { monthAnchorUTC } from "../lib/time.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { docToObject, getDocumentsByIds } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function monthlyByCategory(req: AuthRequest, res: Response) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const type = (req.query.type as "EXPENSE" | "INCOME") || "EXPENSE";
    
    const start = monthAnchorUTC(year, month);
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Obtener transacciones del mes
    const snapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("type", "==", type)
      .where("occurredAt", ">=", Timestamp.fromDate(start))
      .where("occurredAt", "<=", Timestamp.fromDate(end))
      .get();

    const txs = snapshot.docs.map(doc => docToObject(doc));

    // Agrupar por categoría
    const categoryMap = new Map<string, number>();
    txs.forEach((tx: any) => {
      const catId = tx.categoryId || "null";
      categoryMap.set(catId, (categoryMap.get(catId) || 0) + tx.amountCents);
    });

    // Obtener categorías
    const categoryIds = Array.from(categoryMap.keys()).filter(id => id !== "null");
    const categories = await getDocumentsByIds("categories", categoryIds);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));

    const data = Array.from(categoryMap.entries()).map(([categoryId, amountCents]) => ({
      categoryId: categoryId === "null" ? null : categoryId,
      categoryName: categoryId === "null" ? "(Sin categoría)" : (categoriesMap.get(categoryId)?.name || "(Sin categoría)"),
      amountCents
    }));

    res.json({ data });
  } catch (error: any) {
    console.error("Monthly by category error:", error);
    res.status(500).json({ error: error.message || "Error al obtener reporte mensual" });
  }
}
