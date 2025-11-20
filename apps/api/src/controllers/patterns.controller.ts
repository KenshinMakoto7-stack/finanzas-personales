import { Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";

// Analizar transacciones y generar patrones
export async function analyzePatterns(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { months = "6" } = req.query;

  const monthsAgo = parseInt(months as string);
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsAgo);

  // Obtener transacciones recientes
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      occurredAt: { gte: startDate },
      type: { in: ["EXPENSE", "INCOME"] }
    },
    include: {
      category: true,
      account: true
    },
    orderBy: { occurredAt: "desc" }
  });

  // Agrupar por patrones
  const patternMap = new Map<string, any>();

  transactions.forEach((tx) => {
    const dayOfWeek = tx.occurredAt.getDay();
    const dayOfMonth = tx.occurredAt.getDate();
    
    // Crear clave de patrón
    const key = `${tx.categoryId || "null"}-${tx.accountId || "null"}-${dayOfWeek}-${dayOfMonth}`;
    
    if (!patternMap.has(key)) {
      patternMap.set(key, {
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        dayOfWeek,
        dayOfMonth,
        amounts: [],
        descriptions: [],
        frequency: 0,
        lastMatched: tx.occurredAt
      });
    }

    const pattern = patternMap.get(key)!;
    pattern.amounts.push(tx.amountCents);
    if (tx.description) {
      pattern.descriptions.push(tx.description);
    }
    pattern.frequency++;
    if (tx.occurredAt > pattern.lastMatched) {
      pattern.lastMatched = tx.occurredAt;
    }
  });

  // Guardar o actualizar patrones en la base de datos
  const patterns = [];
  for (const [key, patternData] of patternMap.entries()) {
    if (patternData.frequency >= 2) { // Solo patrones que aparecen al menos 2 veces
      const avgAmount = Math.round(
        patternData.amounts.reduce((a: number, b: number) => a + b, 0) / patternData.amounts.length
      );

      // Buscar patrón existente
      const existing = await prisma.transactionPattern.findFirst({
        where: {
          userId,
          categoryId: patternData.categoryId,
          accountId: patternData.accountId,
          dayOfWeek: patternData.dayOfWeek,
          dayOfMonth: patternData.dayOfMonth
        }
      });

      const pattern = existing
        ? await prisma.transactionPattern.update({
            where: { id: existing.id },
            data: {
              amountCents: avgAmount,
              frequency: patternData.frequency,
              lastMatched: patternData.lastMatched
            },
            include: {
              category: true,
              account: true
            }
          })
        : await prisma.transactionPattern.create({
            data: {
              userId,
              categoryId: patternData.categoryId,
              accountId: patternData.accountId,
              amountCents: avgAmount,
              dayOfWeek: patternData.dayOfWeek,
              dayOfMonth: patternData.dayOfMonth,
              frequency: patternData.frequency,
              lastMatched: patternData.lastMatched
            },
            include: {
              category: true,
              account: true
            }
          });

      patterns.push(pattern);
    }
  }

  res.json({ patterns, analyzed: transactions.length });
}

// Obtener sugerencias basadas en patrones
export async function getSuggestions(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const { date } = req.query;

  const targetDate = date ? new Date(date as string) : new Date();
  const dayOfWeek = targetDate.getDay();
  const dayOfMonth = targetDate.getDate();

  // Buscar patrones que coincidan con el día
  const patterns = await prisma.transactionPattern.findMany({
    where: {
      userId,
      OR: [
        { dayOfWeek },
        { dayOfMonth }
      ]
    },
    include: {
      category: true,
      account: true
    },
    orderBy: [
      { frequency: "desc" },
      { lastMatched: "desc" }
    ],
    take: 10
  });

  const suggestions = patterns.map((pattern) => ({
    categoryId: pattern.categoryId,
    category: pattern.category,
    accountId: pattern.accountId,
    account: pattern.account,
    suggestedAmount: pattern.amountCents,
    confidence: Math.min(100, pattern.frequency * 20), // 0-100%
    lastMatched: pattern.lastMatched,
    matchReason: pattern.dayOfMonth === dayOfMonth 
      ? "Ocurre este día del mes" 
      : "Ocurre este día de la semana"
  }));

  res.json({ suggestions });
}

// Listar todos los patrones
export async function listPatterns(req: AuthRequest, res: Response) {
  const patterns = await prisma.transactionPattern.findMany({
    where: { userId: req.user!.userId },
    include: {
      category: true,
      account: true
    },
    orderBy: [
      { frequency: "desc" },
      { lastMatched: "desc" }
    ]
  });

  res.json({ patterns });
}

// Eliminar un patrón
export async function deletePattern(req: AuthRequest, res: Response) {
  await prisma.transactionPattern.delete({
    where: { id: req.params.id, userId: req.user!.userId }
  });

  res.status(204).send();
}

