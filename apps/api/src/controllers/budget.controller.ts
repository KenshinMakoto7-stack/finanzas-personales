import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { docToObject } from "../lib/firestore-helpers.js";

export async function budgetSummary(req: AuthRequest, res: Response) {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    
    // Obtener usuario para timezone
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    
    const result = await getBudgetSummaryForDate(req.user!.userId, date, tz);
    res.json(result);
  } catch (error: any) {
    console.error("Budget summary error:", error);
    res.status(500).json({ error: error.message || "Error al obtener resumen de presupuesto" });
  }
}
