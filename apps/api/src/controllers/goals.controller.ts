import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { monthAnchorUTC } from "../lib/time.js";
import { AuthRequest } from "../server/middleware/auth.js";

export async function upsertGoal(req: AuthRequest, res: Response) {
  const year = Number(req.params.year), month = Number(req.params.month);
  const { savingGoalCents } = req.body || {};
  const monthDate = monthAnchorUTC(year, month);

  const goal = await prisma.monthlyGoal.upsert({
    where: { userId_month: { userId: req.user!.userId, month: monthDate } },
    create: { userId: req.user!.userId, month: monthDate, savingGoalCents: Number(savingGoalCents || 0) },
    update: { savingGoalCents: Number(savingGoalCents || 0) }
  });
  res.json({ goal });
}

export async function getGoal(req: AuthRequest, res: Response) {
  const year = Number(req.params.year), month = Number(req.params.month);
  const monthDate = monthAnchorUTC(year, month);
  const goal = await prisma.monthlyGoal.findUnique({ where: { userId_month: { userId: req.user!.userId, month: monthDate } }});
  res.json({ goal });
}

export async function getGoalByQuery(req: AuthRequest, res: Response) {
  const year = Number(req.query.year), month = Number(req.query.month);
  if (!year || !month) {
    return res.status(400).json({ error: "year y month son requeridos" });
  }
  const monthDate = monthAnchorUTC(year, month);
  const goal = await prisma.monthlyGoal.findUnique({ where: { userId_month: { userId: req.user!.userId, month: monthDate } }});
  res.json({ goal });
}



