import { Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { monthRangeUTC, monthAnchorUTC } from "../lib/time.js";
import { convertCurrency } from "../services/exchange.service.js";

export async function expensesByCategory(req: AuthRequest, res: Response) {
  const { year, month, period = "month" } = req.query as any;
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";

  let start: Date, end: Date;
  
  if (period === "month" && year && month) {
    const range = monthRangeUTC(`${year}-${String(month).padStart(2, "0")}-01`, tz);
    start = range.start;
    end = range.end;
  } else if (period === "quarter" && year) {
    const quarter = Number(req.query.quarter) || 1;
    const startMonth = (quarter - 1) * 3 + 1;
    start = monthAnchorUTC(Number(year), startMonth);
    end = new Date(Date.UTC(Number(year), startMonth + 2, 0, 23, 59, 59, 999));
  } else if (period === "semester" && year) {
    const semester = Number(req.query.semester) || 1;
    const startMonth = (semester - 1) * 6 + 1;
    start = monthAnchorUTC(Number(year), startMonth);
    end = new Date(Date.UTC(Number(year), startMonth + 5, 0, 23, 59, 59, 999));
  } else if (period === "year" && year) {
    start = monthAnchorUTC(Number(year), 1);
    end = new Date(Date.UTC(Number(year), 11, 31, 23, 59, 59, 999));
  } else {
    const today = new Date();
    const range = monthRangeUTC(today.toISOString().slice(0, 10), tz);
    start = range.start;
    end = range.end;
  }

  // Obtener transacciones con su moneda para convertir
  const expenseTransactions = await prisma.transaction.findMany({
    where: {
      userId: req.user!.userId,
      type: "EXPENSE",
      occurredAt: { gte: start, lte: end }
    },
    select: {
      categoryId: true,
      amountCents: true,
      currencyCode: true
    }
  });

  // Convertir todas a UYU (moneda base para comparaciones)
  const baseCurrency = user?.currencyCode || "UYU";
  const convertedExpenses = await Promise.all(
    expenseTransactions.map(async (tx) => ({
      categoryId: tx.categoryId,
      amountCents: tx.currencyCode === baseCurrency
        ? tx.amountCents
        : await convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
    }))
  );

  // Agrupar por categoría
  const expensesByCategory = new Map<string, { amountCents: number; count: number }>();
  convertedExpenses.forEach(tx => {
    const key = tx.categoryId || "null";
    const existing = expensesByCategory.get(key) || { amountCents: 0, count: 0 };
    expensesByCategory.set(key, {
      amountCents: existing.amountCents + tx.amountCents,
      count: existing.count + 1
    });
  });

  const categoryIds = Array.from(expensesByCategory.keys()).filter(id => id !== "null") as string[];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    include: { parent: true }
  });

  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const data = Array.from(expensesByCategory.entries()).map(([categoryId, totals]) => ({
    categoryId: categoryId === "null" ? null : categoryId,
    categoryName: categoryId === "null" ? "Sin categoría" : (categoryMap[categoryId]?.name || "Sin categoría"),
    parentCategoryName: categoryId !== "null" && categoryMap[categoryId]?.parent ? categoryMap[categoryId].parent.name : null,
    amountCents: totals.amountCents,
    count: totals.count
  })).sort((a, b) => b.amountCents - a.amountCents);

  res.json({ period: { start, end, type: period }, data });
}

export async function savingsStatistics(req: AuthRequest, res: Response) {
  const { year } = req.query as any;
  const currentYear = year ? Number(year) : new Date().getFullYear();

  const goals = await prisma.monthlyGoal.findMany({
    where: {
      userId: req.user!.userId,
      month: {
        gte: monthAnchorUTC(currentYear, 1),
        lte: monthAnchorUTC(currentYear, 12)
      }
    },
    orderBy: { month: "asc" }
  });

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";

  const baseCurrency = user?.currencyCode || "UYU";
  
  const monthlyData = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const month = i + 1;
      const range = monthRangeUTC(`${currentYear}-${String(month).padStart(2, "0")}-01`, tz);
      
      // Obtener transacciones con moneda para convertir
      const incomeTransactions = await prisma.transaction.findMany({
        where: {
          userId: req.user!.userId,
          type: "INCOME",
          occurredAt: { gte: range.start, lte: range.end }
        },
        select: { amountCents: true, currencyCode: true }
      });

      const expenseTransactions = await prisma.transaction.findMany({
        where: {
          userId: req.user!.userId,
          type: "EXPENSE",
          occurredAt: { gte: range.start, lte: range.end }
        },
        select: { amountCents: true, currencyCode: true }
      });

      // Convertir a moneda base
      const incomeCents = await Promise.all(
        incomeTransactions.map(tx => 
          tx.currencyCode === baseCurrency 
            ? tx.amountCents 
            : convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
        )
      ).then(amounts => amounts.reduce((sum, amt) => sum + amt, 0));

      const expenseCents = await Promise.all(
        expenseTransactions.map(tx => 
          tx.currencyCode === baseCurrency 
            ? tx.amountCents 
            : convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
        )
      ).then(amounts => amounts.reduce((sum, amt) => sum + amt, 0));

      const goal = goals.find(g => {
        const goalMonth = new Date(g.month);
        return goalMonth.getUTCFullYear() === currentYear && goalMonth.getUTCMonth() + 1 === month;
      });

      // Ya calculado arriba
      const goalCents = goal?.savingGoalCents || 0;
      
      // Calcular ahorro dirigido: ingresos directos a cuentas de tipo SAVINGS
      const savingsAccounts = await prisma.account.findMany({
        where: { userId: req.user!.userId, type: "SAVINGS" },
        select: { id: true }
      });
      const savingsAccountIds = savingsAccounts.map(a => a.id);
      
      const directedSavingsTransactions = await prisma.transaction.findMany({
        where: {
          userId: req.user!.userId,
          type: "INCOME",
          accountId: { in: savingsAccountIds },
          occurredAt: { gte: range.start, lte: range.end }
        },
        select: { amountCents: true, currencyCode: true }
      });
      
      const actualSavings = await Promise.all(
        directedSavingsTransactions.map(tx => 
          tx.currencyCode === baseCurrency 
            ? tx.amountCents 
            : convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
        )
      ).then(amounts => amounts.reduce((sum, amt) => sum + amt, 0));
      const savingsRate = incomeCents > 0 ? (actualSavings / incomeCents) * 100 : 0;

      return {
        month,
        year: currentYear,
        incomeCents,
        expenseCents,
        goalCents,
        actualSavings,
        savingsRate: Math.round(savingsRate * 100) / 100,
        goalAchieved: actualSavings >= goalCents
      };
    })
  );

  const totalIncome = monthlyData.reduce((sum, m) => sum + m.incomeCents, 0);
  const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenseCents, 0);
  const totalSavings = monthlyData.reduce((sum, m) => sum + m.actualSavings, 0); // Ahorro dirigido, no balance
  const totalGoal = goals.reduce((sum, g) => sum + g.savingGoalCents, 0);

  res.json({
    year: currentYear,
    monthly: monthlyData,
    summary: {
      totalIncome,
      totalExpenses,
      totalSavings,
      totalGoal,
      averageSavingsRate: totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 10000) / 100 : 0
    }
  });
}

export async function incomeStatistics(req: AuthRequest, res: Response) {
  const { year } = req.query as any;
  const currentYear = year ? Number(year) : new Date().getFullYear();

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";
  const baseCurrency = user?.currencyCode || "UYU";

  const monthlyData = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const month = i + 1;
      const range = monthRangeUTC(`${currentYear}-${String(month).padStart(2, "0")}-01`, tz);

      // Obtener transacciones con moneda para convertir
      const incomeTransactions = await prisma.transaction.findMany({
        where: {
          userId: req.user!.userId,
          type: "INCOME",
          occurredAt: { gte: range.start, lte: range.end }
        },
        select: { categoryId: true, amountCents: true, currencyCode: true }
      });

      // Convertir todas a moneda base
      const convertedIncomes = await Promise.all(
        incomeTransactions.map(async (tx) => ({
          categoryId: tx.categoryId,
          amountCents: tx.currencyCode === baseCurrency
            ? tx.amountCents
            : await convertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
        }))
      );

      // Agrupar por categoría
      const incomesByCategory = new Map<string, { amountCents: number; count: number }>();
      convertedIncomes.forEach(tx => {
        const key = tx.categoryId || "null";
        const existing = incomesByCategory.get(key) || { amountCents: 0, count: 0 };
        incomesByCategory.set(key, {
          amountCents: existing.amountCents + tx.amountCents,
          count: existing.count + 1
        });
      });

      const categoryIds = Array.from(incomesByCategory.keys()).filter(id => id !== "null") as string[];
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } }
      });
      const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));

      const totalCents = Array.from(incomesByCategory.values())
        .reduce((sum, cat) => sum + cat.amountCents, 0);
      const count = Array.from(incomesByCategory.values())
        .reduce((sum, cat) => sum + cat.count, 0);

      return {
        month,
        totalCents,
        count,
        byCategory: Array.from(incomesByCategory.entries()).map(([categoryId, totals]) => ({
          categoryId: categoryId === "null" ? null : categoryId,
          categoryName: categoryId === "null" ? "Sin categoría" : (categoryMap[categoryId]?.name || "Sin categoría"),
          amountCents: totals.amountCents,
          count: totals.count
        }))
      };
    })
  );

  res.json({ year: currentYear, monthly: monthlyData });
}

export async function fixedCosts(req: AuthRequest, res: Response) {
  // Identificar costos fijos (transacciones recurrentes o que se repiten mes a mes)
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Transacciones recurrentes
  const recurring = await prisma.transaction.findMany({
    where: {
      userId: req.user!.userId,
      type: "EXPENSE",
      isRecurring: true
    },
    include: { category: true, account: true },
    orderBy: { amountCents: "desc" }
  });

  // Identificar gastos que se repiten (mismo monto, misma categoría, cada mes)
  const allExpenses = await prisma.transaction.findMany({
    where: {
      userId: req.user!.userId,
      type: "EXPENSE",
      occurredAt: { gte: sixMonthsAgo }
    },
    include: { category: true }
  });

  // Agrupar por categoría y monto para encontrar patrones
  const expenseMap = new Map<string, any[]>();
  allExpenses.forEach(exp => {
    const key = `${exp.categoryId}-${exp.amountCents}`;
    if (!expenseMap.has(key)) expenseMap.set(key, []);
    expenseMap.get(key)!.push(exp);
  });

  const potentialFixed = Array.from(expenseMap.entries())
    .filter(([_, exps]) => exps.length >= 3) // Aparece al menos 3 veces en 6 meses
    .map(([_, exps]) => {
      const first = exps[0];
      return {
        categoryId: first.categoryId,
        categoryName: first.category?.name || "Sin categoría",
        amountCents: first.amountCents,
        occurrences: exps.length,
        lastOccurrence: exps[exps.length - 1].occurredAt,
        isRecurring: exps.some(e => e.isRecurring)
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);

  res.json({
    recurring: recurring.map(r => ({
      id: r.id,
      description: r.description,
      categoryName: r.category?.name,
      amountCents: r.amountCents,
      currencyCode: r.currencyCode,
      nextOccurrence: r.nextOccurrence,
      recurringRule: r.recurringRule
    })),
    potentialFixed
  });
}

export async function aiInsights(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const tz = user?.timeZone || "UTC";
  const today = new Date();
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const expenses = await prisma.transaction.findMany({
    where: {
      userId: req.user!.userId,
      type: "EXPENSE",
      occurredAt: { gte: threeMonthsAgo }
    },
    include: { category: true }
  });

  const incomes = await prisma.transaction.findMany({
    where: {
      userId: req.user!.userId,
      type: "INCOME",
      occurredAt: { gte: threeMonthsAgo }
    }
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const totalIncome = incomes.reduce((sum, i) => sum + i.amountCents, 0);
  const avgMonthlyExpenses = totalExpenses / 3;
  const avgMonthlyIncome = totalIncome / 3;

  // Análisis por categoría
  const categorySpending = new Map<string, number>();
  expenses.forEach(e => {
    const catName = e.category?.name || "Sin categoría";
    categorySpending.set(catName, (categorySpending.get(catName) || 0) + e.amountCents);
  });

  const topCategory = Array.from(categorySpending.entries())
    .sort((a, b) => b[1] - a[1])[0];

  const insights: Array<{ type: "warning" | "info" | "success"; message: string }> = [];

  // Insight 1: Gasto promedio vs ingresos
  if (avgMonthlyExpenses > avgMonthlyIncome * 0.9) {
    insights.push({
      type: "warning",
      message: `Tus gastos mensuales promedio (${Math.round(avgMonthlyExpenses / 100)}) representan más del 90% de tus ingresos. Considera reducir gastos o aumentar ingresos.`
    });
  } else if (avgMonthlyExpenses < avgMonthlyIncome * 0.7) {
    insights.push({
      type: "success",
      message: `Excelente control: tus gastos representan solo el ${Math.round((avgMonthlyExpenses / avgMonthlyIncome) * 100)}% de tus ingresos.`
    });
  }

  // Insight 2: Categoría con mayor gasto
  if (topCategory) {
    const percentage = (topCategory[1] / totalExpenses) * 100;
    if (percentage > 40) {
      insights.push({
        type: "warning",
        message: `La categoría "${topCategory[0]}" representa el ${Math.round(percentage)}% de tus gastos. Considera revisar si hay oportunidades de ahorro.`
      });
    }
  }

  // Insight 3: Variabilidad de ingresos
  const monthlyIncomes = [0, 0, 0];
  incomes.forEach(i => {
    const month = new Date(i.occurredAt).getMonth();
    const index = (month - (today.getMonth() - 2) + 12) % 12;
    if (index >= 0 && index < 3) monthlyIncomes[index] += i.amountCents;
  });

  const incomeVariance = Math.max(...monthlyIncomes) - Math.min(...monthlyIncomes);
  if (incomeVariance > avgMonthlyIncome * 0.5) {
    insights.push({
      type: "info",
      message: "Tus ingresos varían significativamente mes a mes. Considera crear un fondo de emergencia para meses con menores ingresos."
    });
  }

  res.json({ insights, summary: { avgMonthlyExpenses, avgMonthlyIncome, totalExpenses, totalIncome } });
}


