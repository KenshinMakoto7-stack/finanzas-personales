import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { AccountSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";

export async function listAccounts(req: AuthRequest, res: Response) {
  const rows = await prisma.account.findMany({ where: { userId: req.user!.userId }, orderBy: { createdAt: "asc" }});
  res.json({ accounts: rows });
}

export async function createAccount(req: AuthRequest, res: Response) {
  const parsed = AccountSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }
  const { name, type, currencyCode } = parsed.data;
  const acc = await prisma.account.create({ data: { userId: req.user!.userId, name, type, currencyCode }});
  res.status(201).json({ account: acc });
}

export async function updateAccount(req: AuthRequest, res: Response) {
  const { name } = req.body || {};
  const acc = await prisma.account.update({ where: { id: req.params.id, userId: req.user!.userId }, data: { name: name || undefined }});
  res.json({ account: acc });
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  // Si tiene transacciones, podrías bloquear o pedir migración (post‑MVP: fusionar)
  await prisma.account.delete({ where: { id: req.params.id, userId: req.user!.userId }});
  res.status(204).send();
}



