import { Request, Response } from "express";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { monthRangeUTC, monthAnchorUTC } from "../lib/time.js";
import { safeConvertCurrency, getExchangeRatesMap, convertAmountWithRate } from "../services/exchange.service.js";
import { docToObject, getDocumentsByIds } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

export async function expensesByCategory(req: AuthRequest, res: Response) {
  try {
    const { year, month, period = "month" } = req.query as any;
    
    // Obtener usuario
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";

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
    const expenseSnapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("type", "==", "EXPENSE")
      .where("occurredAt", ">=", Timestamp.fromDate(start))
      .where("occurredAt", "<=", Timestamp.fromDate(end))
      .get();

    const expenseTransactions = expenseSnapshot.docs.map(doc => docToObject(doc));

    // Convertir todas a UYU (moneda base para comparaciones)
    const baseCurrency = userData.currencyCode || "UYU";
    const convertedExpenses = await Promise.all(
      expenseTransactions.map(async (tx: any) => ({
        categoryId: tx.categoryId,
        amountCents: tx.currencyCode === baseCurrency
          ? tx.amountCents
          : await safeConvertCurrency(tx.amountCents, tx.currencyCode, baseCurrency)
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
    const categories = await getDocumentsByIds("categories", categoryIds);
    
    // Cargar padres
    const parentIds = [...new Set(categories.map((c: any) => c.parentId).filter(Boolean))];
    const parents = await getDocumentsByIds("categories", parentIds);
    
    const parentsMap = new Map(parents.map((p: any) => [p.id, p]));
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, { ...c, parent: c.parentId ? parentsMap.get(c.parentId) : null }]));

    const data = Array.from(expensesByCategory.entries()).map(([categoryId, totals]) => ({
      categoryId: categoryId === "null" ? null : categoryId,
      categoryName: categoryId === "null" ? "Sin categoría" : (categoryMap[categoryId]?.name || "Sin categoría"),
      parentCategoryName: categoryId !== "null" && categoryMap[categoryId]?.parent ? categoryMap[categoryId].parent.name : null,
      amountCents: totals.amountCents,
      count: totals.count
    })).sort((a, b) => b.amountCents - a.amountCents);

    res.json({ period: { start, end, type: period }, data });
  } catch (error: any) {
    console.error("Expenses by category error:", error);
    res.status(500).json({ error: error.message || "Error al obtener gastos por categoría" });
  }
}

export async function savingsStatistics(req: AuthRequest, res: Response) {
  try {
    const { year } = req.query as any;
    const currentYear = year ? Number(year) : new Date().getFullYear();

    // Obtener metas del año
    const yearStart = monthAnchorUTC(currentYear, 1);
    const yearEnd = monthAnchorUTC(currentYear, 12);
    
    // Obtener metas sin orderBy para evitar índice compuesto
    const goalsSnapshot = await db.collection("monthlyGoals")
      .where("userId", "==", req.user!.userId)
      .get();

    // Filtrar y ordenar en memoria
    const goals = goalsSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((goal: any) => {
        const goalDate = goal.month instanceof Date ? goal.month : new Date(goal.month);
        return goalDate >= yearStart && goalDate <= yearEnd;
      })
      .sort((a: any, b: any) => {
        const dateA = a.month instanceof Date ? a.month : new Date(a.month);
        const dateB = b.month instanceof Date ? b.month : new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });

    // Obtener usuario
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const baseCurrency = userData.currencyCode || "UYU";

    // OPTIMIZACIÓN: Una query para todo el año en lugar de 12 queries por mes
    const yearStartTimestamp = Timestamp.fromDate(yearStart);
    const yearEndTimestamp = Timestamp.fromDate(yearEnd);

    // Obtener todas las transacciones del año de una vez
    const [allIncomeSnapshot, allExpenseSnapshot, savingsAccountsSnapshot] = await Promise.all([
      db.collection("transactions")
        .where("userId", "==", req.user!.userId)
        .where("type", "==", "INCOME")
        .where("occurredAt", ">=", yearStartTimestamp)
        .where("occurredAt", "<=", yearEndTimestamp)
        .get(),
      db.collection("transactions")
        .where("userId", "==", req.user!.userId)
        .where("type", "==", "EXPENSE")
        .where("occurredAt", ">=", yearStartTimestamp)
        .where("occurredAt", "<=", yearEndTimestamp)
        .get(),
      db.collection("accounts")
        .where("userId", "==", req.user!.userId)
        .where("type", "==", "SAVINGS")
        .get()
    ]);

    const allIncomeTransactions = allIncomeSnapshot.docs.map(doc => docToObject(doc));
    const allExpenseTransactions = allExpenseSnapshot.docs.map(doc => docToObject(doc));
    const savingsAccountIds = savingsAccountsSnapshot.docs.map(doc => doc.id);

    // Obtener ahorros dirigidos del año completo
    const allDirectedSavingsSnapshot = savingsAccountIds.length > 0
      ? await db.collection("transactions")
          .where("userId", "==", req.user!.userId)
          .where("type", "==", "INCOME")
          .where("accountId", "in", savingsAccountIds.slice(0, 10)) // Firestore limita a 10
          .where("occurredAt", ">=", yearStartTimestamp)
          .where("occurredAt", "<=", yearEndTimestamp)
          .get()
      : { docs: [] };

    const allDirectedSavingsTransactions = allDirectedSavingsSnapshot.docs.map(doc => docToObject(doc));

    // OPTIMIZACIÓN: Obtener rates una sola vez
    const uniqueCurrencies = [
      ...new Set([
        ...allIncomeTransactions.map((t: any) => t.currencyCode),
        ...allExpenseTransactions.map((t: any) => t.currencyCode),
        ...allDirectedSavingsTransactions.map((t: any) => t.currencyCode)
      ])
    ].filter(c => c && c !== baseCurrency);

    const rateMap = await getExchangeRatesMap(uniqueCurrencies, baseCurrency);

    // Función helper para agrupar transacciones por mes
    const groupByMonth = (transactions: any[], tz: string) => {
      const byMonth: { [key: number]: any[] } = {};
      for (let month = 1; month <= 12; month++) {
        byMonth[month] = [];
      }

      transactions.forEach((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        const month = txDate.getUTCMonth() + 1;
        if (month >= 1 && month <= 12) {
          byMonth[month].push(tx);
        }
      });

      return byMonth;
    };

    const incomeByMonth = groupByMonth(allIncomeTransactions, tz);
    const expenseByMonth = groupByMonth(allExpenseTransactions, tz);
    const directedSavingsByMonth = groupByMonth(allDirectedSavingsTransactions, tz);

    // Procesar cada mes (ahora solo procesamiento en memoria, sin queries)
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      
      // Convertir transacciones del mes a moneda base (síncrono, usando rateMap)
      const incomeCents = incomeByMonth[month].reduce((sum, tx: any) => {
        const converted = convertAmountWithRate(tx.amountCents, tx.currencyCode, baseCurrency, rateMap);
        return sum + converted;
      }, 0);

      const expenseCents = expenseByMonth[month].reduce((sum, tx: any) => {
        const converted = convertAmountWithRate(tx.amountCents, tx.currencyCode, baseCurrency, rateMap);
        return sum + converted;
      }, 0);

      const actualSavings = directedSavingsByMonth[month].reduce((sum, tx: any) => {
        const converted = convertAmountWithRate(tx.amountCents, tx.currencyCode, baseCurrency, rateMap);
        return sum + converted;
      }, 0);

      const goal = goals.find((g: any) => {
        const goalMonth = g.month instanceof Date ? g.month : new Date(g.month);
        return goalMonth.getUTCFullYear() === currentYear && goalMonth.getUTCMonth() + 1 === month;
      });

      const goalCents = goal?.savingGoalCents || 0;
      const savingsRate = incomeCents > 0 ? (actualSavings / incomeCents) * 100 : 0;

      return {
        month,
        year: currentYear,
        incomeCents,
        expenseCents,
        goalCents,
        actualSavings,
        savingsRate: Math.round(savingsRate * 100) / 100
      };
    });

    const totalIncome = monthlyData.reduce((sum, m) => sum + m.incomeCents, 0);
    const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenseCents, 0);
    const totalSavings = monthlyData.reduce((sum, m) => sum + m.actualSavings, 0);
    const totalGoal = goals.reduce((sum, g: any) => sum + (g.savingGoalCents || 0), 0);

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
  } catch (error: any) {
    console.error("Savings statistics error:", error);
    res.status(500).json({ error: error.message || "Error al obtener estadísticas de ahorro" });
  }
}

export async function incomeStatistics(req: AuthRequest, res: Response) {
  try {
    const { year } = req.query as any;
    const currentYear = year ? Number(year) : new Date().getFullYear();

    // Obtener usuario
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const baseCurrency = userData.currencyCode || "UYU";

    // OPTIMIZACIÓN: Una query para todo el año en lugar de 12 queries por mes
    const yearStartTimestamp = Timestamp.fromDate(monthAnchorUTC(currentYear, 1));
    const yearEndTimestamp = Timestamp.fromDate(monthAnchorUTC(currentYear, 12));

    // Obtener todas las transacciones de ingresos del año de una vez
    const allIncomeSnapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("type", "==", "INCOME")
      .where("occurredAt", ">=", yearStartTimestamp)
      .where("occurredAt", "<=", yearEndTimestamp)
      .get();

    const allIncomeTransactions = allIncomeSnapshot.docs.map(doc => docToObject(doc));

    // OPTIMIZACIÓN: Obtener rates una sola vez
    const uniqueCurrencies = [...new Set(allIncomeTransactions.map((t: any) => t.currencyCode))].filter(c => c && c !== baseCurrency);
    const rateMap = await getExchangeRatesMap(uniqueCurrencies, baseCurrency);

    // Función helper para agrupar transacciones por mes
    const groupByMonth = (transactions: any[]) => {
      const byMonth: { [key: number]: any[] } = {};
      for (let month = 1; month <= 12; month++) {
        byMonth[month] = [];
      }

      transactions.forEach((tx: any) => {
        const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
        const month = txDate.getUTCMonth() + 1;
        if (month >= 1 && month <= 12) {
          byMonth[month].push(tx);
        }
      });

      return byMonth;
    };

    const incomeByMonth = groupByMonth(allIncomeTransactions);

    // Obtener todas las categorías necesarias de una vez
    const allCategoryIds = [...new Set(allIncomeTransactions.map((t: any) => t.categoryId).filter(Boolean))];
    const allCategories = await getDocumentsByIds("categories", allCategoryIds);
    const categoryMap = Object.fromEntries(allCategories.map((c: any) => [c.id, c]));

    // Procesar cada mes (ahora solo procesamiento en memoria, sin queries)
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthTransactions = incomeByMonth[month] || [];

      // Convertir todas a moneda base (síncrono, usando rateMap)
      const convertedIncomes = monthTransactions.map((tx: any) => ({
        categoryId: tx.categoryId,
        amountCents: convertAmountWithRate(tx.amountCents, tx.currencyCode, baseCurrency, rateMap)
      }));

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
    });

    res.json({ year: currentYear, monthly: monthlyData });
  } catch (error: any) {
    console.error("Income statistics error:", error);
    res.status(500).json({ error: error.message || "Error al obtener estadísticas de ingresos" });
  }
}

export async function fixedCosts(req: AuthRequest, res: Response) {
  try {
    // Obtener usuario
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Transacciones recurrentes - sin orderBy para evitar índice compuesto
    const recurringSnapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("isRecurring", "==", true)
      .get();

    const recurring = recurringSnapshot.docs
      .map(doc => docToObject(doc))
      .filter((tx: any) => tx.type === "EXPENSE")
      .sort((a: any, b: any) => (b.amountCents || 0) - (a.amountCents || 0));

    // Cargar relaciones
    const categoryIds = [...new Set(recurring.map((r: any) => r.categoryId).filter(Boolean))];
    const accountIds = [...new Set(recurring.map((r: any) => r.accountId))];

    const [categories, accounts] = await Promise.all([
      getDocumentsByIds("categories", categoryIds),
      getDocumentsByIds("accounts", accountIds)
    ]);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));
    const accountsMap = new Map(accounts.map((a: any) => [a.id, a]));

    const recurringWithRelations = recurring.map((r: any) => ({
      ...r,
      category: r.categoryId ? categoriesMap.get(r.categoryId) : null,
      account: accountsMap.get(r.accountId) || null
    }));

    // Identificar gastos que se repiten (mismo monto, misma categoría, cada mes)
    const allExpensesSnapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("type", "==", "EXPENSE")
      .where("occurredAt", ">=", Timestamp.fromDate(sixMonthsAgo))
      .get();

    const allExpenses = allExpensesSnapshot.docs.map(doc => docToObject(doc));

    // Agrupar por categoría y monto para encontrar patrones
    const expenseMap = new Map<string, any[]>();
    allExpenses.forEach((exp: any) => {
      const key = `${exp.categoryId || "null"}-${exp.amountCents}`;
      if (!expenseMap.has(key)) expenseMap.set(key, []);
      expenseMap.get(key)!.push(exp);
    });

    const potentialFixed = Array.from(expenseMap.entries())
      .filter(([_, exps]) => exps.length >= 3) // Aparece al menos 3 veces en 6 meses
      .map(([_, exps]) => {
        const first = exps[0];
        const category = first.categoryId ? categoriesMap.get(first.categoryId) : null;
        return {
          categoryId: first.categoryId,
          categoryName: category?.name || "Sin categoría",
          amountCents: first.amountCents,
          occurrences: exps.length,
          lastOccurrence: exps[exps.length - 1].occurredAt,
          isRecurring: exps.some((e: any) => e.isRecurring)
        };
      })
      .sort((a, b) => b.amountCents - a.amountCents);

    res.json({
      recurring: recurringWithRelations.map((r: any) => ({
        id: r.id,
        description: r.description,
        categoryName: r.category?.name,
        amountCents: r.amountCents,
        currencyCode: r.currencyCode,
        nextOccurrence: r.nextOccurrence,
        isPaid: r.isPaid,
        remainingOccurrences: r.remainingOccurrences
      })),
      potentialFixed
    });
  } catch (error: any) {
    console.error("Fixed costs error:", error);
    res.status(500).json({ error: error.message || "Error al obtener costos fijos" });
  }
}

export async function aiInsights(req: AuthRequest, res: Response) {
  try {
    // Obtener usuario
    const userDoc = await db.collection("users").doc(req.user!.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Obtener gastos
    const expensesSnapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("type", "==", "EXPENSE")
      .where("occurredAt", ">=", Timestamp.fromDate(threeMonthsAgo))
      .get();

    const expenses = expensesSnapshot.docs.map(doc => docToObject(doc));

    // Cargar categorías
    const categoryIds = [...new Set(expenses.map((e: any) => e.categoryId).filter(Boolean))];
    const categories = await getDocumentsByIds("categories", categoryIds);

    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));

    const expensesWithCategories = expenses.map((e: any) => ({
      ...e,
      category: e.categoryId ? categoriesMap.get(e.categoryId) : null
    }));

    // Obtener ingresos
    const incomesSnapshot = await db.collection("transactions")
      .where("userId", "==", req.user!.userId)
      .where("type", "==", "INCOME")
      .where("occurredAt", ">=", Timestamp.fromDate(threeMonthsAgo))
      .get();

    const incomes = incomesSnapshot.docs.map(doc => docToObject(doc));

    const totalExpenses = expensesWithCategories.reduce((sum, e: any) => sum + e.amountCents, 0);
    const totalIncome = incomes.reduce((sum, i: any) => sum + i.amountCents, 0);
    const avgMonthlyExpenses = totalExpenses / 3;
    const avgMonthlyIncome = totalIncome / 3;

    // Análisis por categoría
    const categorySpending = new Map<string, number>();
    expensesWithCategories.forEach((e: any) => {
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
    incomes.forEach((i: any) => {
      const occurredAt = i.occurredAt instanceof Date ? i.occurredAt : new Date(i.occurredAt);
      const month = occurredAt.getMonth();
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
  } catch (error: any) {
    console.error("AI insights error:", error);
    res.status(500).json({ error: error.message || "Error al obtener insights" });
  }
}
