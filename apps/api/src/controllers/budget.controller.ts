import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { AuthRequest } from "../server/middleware/auth.js";

export async function budgetSummary(req: AuthRequest, res: Response) {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";
  const result = await getBudgetSummaryForDate(req.user!.userId, date, tz);
  res.json(result);
}



