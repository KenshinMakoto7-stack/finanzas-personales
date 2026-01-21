import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function alertsPreview(req: AuthRequest, res: Response) {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    
    // Obtener usuario para timezone
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const baseCurrency = userData.currencyCode || "UYU";
    const budgetCycleDay = userData.budgetCycleDay ?? null;
    
    const result = await getBudgetSummaryForDate(req.user!.userId, date, tz, baseCurrency, budgetCycleDay);
    const alerts: Array<{ level: "info" | "warn" | "danger"; message: string }> = [];

    if (result.data.safety.overspend) {
      alerts.push({ level: "danger", message: "Has gastado por encima del disponible del mes." });
    }
    
    const diff = result.data.startOfDay.dailyTargetCents - (result.data.endOfDay.availableCents < 0 ? 0 : result.data.endOfDay.rolloverFromTodayCents);
    
    if (result.data.startOfDay.dailyTargetCents < 0) {
      alerts.push({ level: "warn", message: "Tu promedio de hoy es negativo: ajusta meta o ingresos." });
    }
    
    res.json({ alerts, budget: result.data });
  } catch (error: any) {
    console.error("Alerts preview error:", error);
    res.status(500).json({ error: error.message || "Error al obtener alertas" });
  }
}
