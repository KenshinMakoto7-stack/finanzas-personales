import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { AuthRequest } from "../server/middleware/auth.js";

export async function alertsPreview(req: AuthRequest, res: Response) {
  const date = (req.query.date as string) || new Date().toISOString().slice(0,10);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }});
  const tz = user?.timeZone || "UTC";
  const result = await getBudgetSummaryForDate(req.user!.userId, date, tz);
  const alerts: Array<{ level: "info"|"warn"|"danger"; message: string }> = [];

  if (result.data.safety.overspend) {
    alerts.push({ level: "danger", message: "Has gastado por encima del disponible del mes." });
  }
  const diff = result.data.startOfDay.dailyTargetCents - (result.data.endOfDay.availableCents < 0 ? 0 : result.data.endOfDay.rolloverFromTodayCents);
  // Nota: solo ejemplo; puedes añadir más reglas
  if (result.data.startOfDay.dailyTargetCents < 0) {
    alerts.push({ level: "warn", message: "Tu promedio de hoy es negativo: ajusta meta o ingresos." });
  }
  res.json({ alerts, budget: result.data });
}



