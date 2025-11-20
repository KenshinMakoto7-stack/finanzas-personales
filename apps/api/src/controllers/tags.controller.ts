import { Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { z } from "zod";

const TagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().default("#667eea")
});

export async function listTags(req: AuthRequest, res: Response) {
  const tags = await prisma.tag.findMany({
    where: { userId: req.user!.userId },
    include: {
      _count: {
        select: { transactions: true }
      }
    },
    orderBy: { name: "asc" }
  });

  const tagsWithCount = tags.map(tag => ({
    ...tag,
    transactionCount: tag._count.transactions
  }));

  res.json({ tags: tagsWithCount });
}

export async function createTag(req: AuthRequest, res: Response) {
  const parsed = TagSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }

  const { name, color } = parsed.data;
  const userId = req.user!.userId;

  const tag = await prisma.tag.create({
    data: { userId, name, color }
  });

  res.status(201).json({ tag });
}

export async function updateTag(req: AuthRequest, res: Response) {
  const { name, color } = req.body;
  const userId = req.user!.userId;
  const tagId = req.params.id;

  const tag = await prisma.tag.update({
    where: { id: tagId, userId },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color })
    }
  });

  res.json({ tag });
}

export async function deleteTag(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const tagId = req.params.id;

  await prisma.tag.delete({
    where: { id: tagId, userId }
  });

  res.status(204).send();
}

// Asociar/desasociar tags de transacciones
export async function addTagToTransaction(req: AuthRequest, res: Response) {
  const { transactionId, tagId } = req.body;
  const userId = req.user!.userId;

  // Verificar que la transacción pertenece al usuario
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId }
  });

  if (!transaction) {
    return res.status(404).json({ error: "Transacción no encontrada" });
  }

  // Verificar que el tag pertenece al usuario
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, userId }
  });

  if (!tag) {
    return res.status(404).json({ error: "Tag no encontrado" });
  }

  const transactionTag = await prisma.transactionTag.create({
    data: { transactionId, tagId },
    include: { tag: true }
  });

  res.status(201).json({ transactionTag });
}

export async function removeTagFromTransaction(req: AuthRequest, res: Response) {
  const { transactionId, tagId } = req.params;
  const userId = req.user!.userId;

  // Verificar que la transacción pertenece al usuario
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId }
  });

  if (!transaction) {
    return res.status(404).json({ error: "Transacción no encontrada" });
  }

  await prisma.transactionTag.deleteMany({
    where: { transactionId, tagId }
  });

  res.status(204).send();
}

