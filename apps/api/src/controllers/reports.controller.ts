import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { monthAnchorUTC } from "../lib/time.js";
import { AuthRequest } from "../server/middleware/auth.js";

export async function monthlyByCategory(req: AuthRequest, res: Response) {
  const year = Number(req.query.year), month = Number(req.query.month);
  const type = (req.query.type as "EXPENSE"|"INCOME") || "EXPENSE";
  const start = monthAnchorUTC(year, month);
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    _sum: { amountCents: true },
    where: { userId: req.user!.userId, type, occurredAt: { gte: start, lte: end } }
  });

  const categories = await prisma.category.findMany({ where: { id: { in: rows.map(r => r.categoryId!).filter(Boolean) as string[] } }});
  const map = Object.fromEntries(categories.map(c => [c.id, c]));
  const data = rows.map(r => ({
    categoryId: r.categoryId,
    categoryName: r.categoryId ? map[r.categoryId]?.name ?? "(Sin categoría)" : "(Sin categoría)",
    amountCents: r._sum.amountCents ?? 0
  }));
  res.json({ data });
}



