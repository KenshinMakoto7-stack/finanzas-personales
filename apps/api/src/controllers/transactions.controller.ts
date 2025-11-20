import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { TransactionSchema } from "@pf/shared";
import { AuthRequest } from "../server/middleware/auth.js";

export async function listTransactions(req: AuthRequest, res: Response) {
  const { 
    from, 
    to, 
    categoryId, 
    accountId, 
    type,
    tagId,
    minAmount,
    maxAmount,
    search,
    isRecurring,
    page = "1", 
    pageSize = "50",
    sortBy = "occurredAt",
    sortOrder = "desc"
  } = req.query as any;
  
  const where: any = { userId: req.user!.userId };
  
  // Filtros de fecha
  if (from || to) {
    where.occurredAt = { 
      ...(from ? { gte: new Date(from) } : {}), 
      ...(to ? { lte: new Date(to) } : {}) 
    };
  }
  
  // Filtros básicos
  if (categoryId) where.categoryId = String(categoryId);
  if (accountId) where.accountId = String(accountId);
  if (type) where.type = type;
  if (isRecurring !== undefined) where.isRecurring = isRecurring === "true";
  
  // Filtros de monto
  if (minAmount || maxAmount) {
    where.amountCents = {
      ...(minAmount ? { gte: Number(minAmount) } : {}),
      ...(maxAmount ? { lte: Number(maxAmount) } : {})
    };
  }
  
  // Búsqueda por texto en descripción
  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }
  
  // Filtro por tag
  if (tagId) {
    where.tags = {
      some: {
        tagId: String(tagId)
      }
    };
  }
  
  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);
  
  const orderBy: any = {};
  orderBy[sortBy || "occurredAt"] = sortOrder || "desc";
  
  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({ 
      where, 
      include: {
        category: true,
        account: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy, 
      skip, 
      take 
    }),
    prisma.transaction.count({ where })
  ]);
  
  // Formatear tags
  const transactions = rows.map(tx => ({
    ...tx,
    tags: tx.tags.map(tt => tt.tag)
  }));
  
  res.json({ transactions, page: Number(page), pageSize: take, total });
}

export async function createTransaction(req: AuthRequest, res: Response) {
  const parsed = TransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    // Formatear errores de Zod de manera legible
    const errors = parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return res.status(400).json({ error: `Error de validación: ${errors}` });
  }
  const { accountId, categoryId, type, amountCents, currencyCode, occurredAt, description, isRecurring, recurringRule, nextOccurrence } = parsed.data;
  const notificationSchedule = (req.body as any).notificationSchedule ? JSON.stringify((req.body as any).notificationSchedule) : null;
  const isPaid = (req.body as any).isPaid || false;
  const totalOccurrences = (req.body as any).totalOccurrences !== undefined ? (req.body as any).totalOccurrences : null;
  const remainingOccurrences = (req.body as any).remainingOccurrences !== undefined ? (req.body as any).remainingOccurrences : null;

  // Validar que amountCents sea positivo y entero (ya redondeado)
  if (amountCents <= 0) {
    return res.status(400).json({ error: "El importe debe ser mayor a 0" });
  }

  // Verificar que la categoría existe y pertenece al usuario (OBLIGATORIO)
  if (!categoryId) {
    return res.status(400).json({ error: "La categoría es obligatoria" });
  }
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId: req.user!.userId }
  });
  if (!category) {
    return res.status(400).json({ error: "Categoría no válida" });
  }

  // Verificar que la cuenta existe y pertenece al usuario
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: req.user!.userId }
  });
  if (!account) {
    return res.status(400).json({ error: "Cuenta no válida" });
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: req.user!.userId,
      accountId,
      categoryId, // Validado arriba como obligatorio
      type,
      amountCents: Math.round(Number(amountCents)), // Asegurar que sea entero
      currencyCode: currencyCode || account.currencyCode,
      occurredAt: new Date(occurredAt),
      description: description || null,
      isRecurring: isRecurring || false,
      recurringRule: recurringRule || null,
      nextOccurrence: nextOccurrence ? new Date(nextOccurrence) : null,
      notificationSchedule: notificationSchedule || null,
      isPaid: isRecurring ? isPaid : false,
      totalOccurrences: isRecurring ? totalOccurrences : null,
      remainingOccurrences: isRecurring ? remainingOccurrences : null
    },
    include: {
      category: {
        include: {
          parent: true
        }
      }
    }
  });

  // Si la transacción usa una subcategoría de "Deudas", actualizar el progreso de la deuda
  if (tx.category && tx.category.parent && tx.category.parent.name === "Deudas" && type === "EXPENSE") {
    try {
      // Buscar la deuda que corresponde a esta subcategoría (por nombre)
      const debt = await prisma.debt.findFirst({
        where: {
          userId: req.user!.userId,
          description: tx.category.name
        }
      });

      if (debt && debt.paidInstallments < debt.totalInstallments) {
        // Incrementar las cuotas pagadas
        const newPaidInstallments = Math.min(debt.paidInstallments + 1, debt.totalInstallments);
        await prisma.debt.update({
          where: { id: debt.id },
          data: {
            paidInstallments: newPaidInstallments
          }
        });
        console.log(`Deuda "${debt.description}" actualizada: ${newPaidInstallments}/${debt.totalInstallments} cuotas pagadas`);
      }
    } catch (error: any) {
      // No fallar la creación de la transacción si hay un error al actualizar la deuda
      console.error("Error al actualizar el progreso de la deuda:", error);
    }
  }

  res.status(201).json({ transaction: tx });
}

export async function updateTransaction(req: AuthRequest, res: Response) {
  const { accountId, categoryId, type, amountCents, occurredAt, description, isRecurring, recurringRule, nextOccurrence, isPaid, totalOccurrences, remainingOccurrences } = req.body || {};

  const updateData: any = {
    accountId: accountId || undefined,
    categoryId: categoryId ?? undefined,
    type: type || undefined,
    amountCents: amountCents !== undefined ? Math.round(Number(amountCents)) : undefined,
    occurredAt: occurredAt ? new Date(occurredAt) : undefined,
    description: description || undefined,
    isRecurring: isRecurring ?? undefined,
    recurringRule: recurringRule || undefined,
    nextOccurrence: nextOccurrence ? new Date(nextOccurrence) : undefined,
    isPaid: isPaid !== undefined ? isPaid : undefined,
    totalOccurrences: totalOccurrences !== undefined ? totalOccurrences : undefined,
    remainingOccurrences: remainingOccurrences !== undefined ? remainingOccurrences : undefined,
  };
  
  const tx = await prisma.transaction.update({
    where: { id: req.params.id, userId: req.user!.userId },
    data: updateData
  });
  res.json({ transaction: tx });
}

export async function deleteTransaction(req: AuthRequest, res: Response) {
  await prisma.transaction.delete({ where: { id: req.params.id, userId: req.user!.userId }});
  res.status(204).send();
}


