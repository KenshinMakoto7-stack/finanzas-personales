import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";

export async function exportCSV(req: AuthRequest, res: Response) {
  const { from, to } = req.query as any;
  const where: any = { userId: req.user!.userId };
  if (from || to) where.occurredAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

  const txs = await prisma.transaction.findMany({ where, orderBy: { occurredAt: "asc" }, include: { account: true, category: true }});
  const header = "date,type,amountCents,account,category,description\n";
  const rows = txs.map(t =>
    [
      t.occurredAt.toISOString(),
      t.type,
      t.amountCents,
      t.account.name,
      t.category?.name || "",
      (t.description || "").replace(/[\n,]/g, " ")
    ].join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
  res.send(header + rows + "\n");
}

export async function exportJSON(req: AuthRequest, res: Response) {
  const { from, to } = req.query as any;
  const where: any = { userId: req.user!.userId };
  if (from || to) where.occurredAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  const txs = await prisma.transaction.findMany({ where, orderBy: { occurredAt: "asc" }});
  res.json({ transactions: txs });
}



