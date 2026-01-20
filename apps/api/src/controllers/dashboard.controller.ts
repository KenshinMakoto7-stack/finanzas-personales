import { Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../lib/firebase.js";
import { AuthRequest } from "../server/middleware/auth.js";
import { monthRangeUTC, dayRangeUTC } from "../lib/time.js";
import { docToObject, getDocumentsByIds } from "../lib/firestore-helpers.js";
import { getBudgetSummaryForDate } from "../services/budget.service.js";
import { getExchangeRatesMap, convertAmountWithRate } from "../services/exchange.service.js";

type CacheEntry = { timestamp: number; data: any };
const dashboardCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

async function getTransactionsInRange(userId: string, start: Date, end: Date) {
  try {
    return await db.collection("transactions")
      .where("userId", "==", userId)
      .where("occurredAt", ">=", Timestamp.fromDate(start))
      .where("occurredAt", "<=", Timestamp.fromDate(end))
      .orderBy("occurredAt", "asc")
      .get();
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("index") || message.includes("INDEX")) {
      return await db.collection("transactions")
        .where("userId", "==", userId)
        .get();
    }
    throw error;
  }
}

export async function dashboardSummary(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const cacheKey = `${userId}:${dateParam}`;
    const now = Date.now();

    const cached = dashboardCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const userData = userDoc.data()!;
    const tz = userData.timeZone || "UTC";
    const baseCurrency = userData.currencyCode || "UYU";

    const monthRange = monthRangeUTC(dateParam, tz);
    const dayRange = dayRangeUTC(dateParam, tz);
    const monthAnchor = new Date(Date.UTC(monthRange.year, monthRange.month - 1, 1));

    const [budget, accountsSnapshot, goalSnapshot, monthTxSnapshot] = await Promise.all([
      getBudgetSummaryForDate(userId, dateParam, tz),
      db.collection("accounts").where("userId", "==", userId).get(),
      db.collection("monthlyGoals")
        .where("userId", "==", userId)
        .where("month", "==", Timestamp.fromDate(monthAnchor))
        .limit(1)
        .get(),
      getTransactionsInRange(userId, monthRange.start, monthRange.end)
    ]);

    const accounts = accountsSnapshot.docs.map(doc => docToObject(doc));
    const monthTransactions = monthTxSnapshot.docs.map(doc => docToObject(doc));

    const uniqueCurrencies = [...new Set(monthTransactions.map((t: any) => t.currencyCode).filter(Boolean))];
    const rateMap = await getExchangeRatesMap(uniqueCurrencies, baseCurrency);

    const convert = (amountCents: number, currencyCode: string) =>
      convertAmountWithRate(amountCents, currencyCode || baseCurrency, baseCurrency, rateMap);

    const expenses = monthTransactions.filter((t: any) => t.type === "EXPENSE");
    const incomes = monthTransactions.filter((t: any) => t.type === "INCOME");

    const totalIncomeCents = incomes.reduce((sum: number, t: any) => sum + convert(t.amountCents, t.currencyCode), 0);
    const totalExpenseCents = expenses.reduce((sum: number, t: any) => sum + convert(t.amountCents, t.currencyCode), 0);

    const savingsAccountIds = accounts.filter((a: any) => a.type === "SAVINGS").map((a: any) => a.id);
    const directedSavingsCents = incomes
      .filter((t: any) => savingsAccountIds.includes(t.accountId))
      .reduce((sum: number, t: any) => sum + convert(t.amountCents, t.currencyCode), 0);

    const goalDoc = goalSnapshot.empty ? null : goalSnapshot.docs[0].data();
    const savingGoalCents = goalDoc?.savingGoalCents || 0;
    const goalProgress = savingGoalCents > 0
      ? Math.min(100, Math.round((directedSavingsCents / savingGoalCents) * 100))
      : 0;

    const expensesByCategoryMap = new Map<string, { amountCents: number; count: number }>();
    expenses.forEach((tx: any) => {
      const key = tx.categoryId || "null";
      const existing = expensesByCategoryMap.get(key) || { amountCents: 0, count: 0 };
      expensesByCategoryMap.set(key, {
        amountCents: existing.amountCents + convert(tx.amountCents, tx.currencyCode),
        count: existing.count + 1
      });
    });

    const categoryIds = Array.from(expensesByCategoryMap.keys()).filter(id => id !== "null") as string[];
    const categories = await getDocumentsByIds("categories", categoryIds);
    const categoriesMap = new Map(categories.map((c: any) => [c.id, c]));

    const expensesByCategory = Array.from(expensesByCategoryMap.entries())
      .map(([categoryId, totals]) => ({
        categoryId: categoryId === "null" ? null : categoryId,
        categoryName: categoryId === "null"
          ? "Sin categoría"
          : (categoriesMap.get(categoryId)?.name || "Sin categoría"),
        amountCents: totals.amountCents,
        count: totals.count
      }))
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 5);

    const dayStart = dayRange.start.getTime();
    const dayEnd = dayRange.end.getTime();
    const spentTodayCents = expenses.reduce((sum: number, t: any) => {
      const occurredAt = t.occurredAt instanceof Date ? t.occurredAt : new Date(t.occurredAt);
      const time = occurredAt.getTime();
      if (time < dayStart || time > dayEnd) return sum;
      return sum + convert(t.amountCents, t.currencyCode);
    }, 0);

    const dailyBudgetCents = budget?.data?.startOfDay?.dailyTargetCents || 0;
    const dailyTargetTomorrowCents = budget?.data?.endOfDay?.dailyTargetTomorrowCents || 0;
    const remainingTodayCents = dailyBudgetCents - spentTodayCents;

    const availableBalanceCents = totalIncomeCents - totalExpenseCents - savingGoalCents;

    // Datos históricos (últimos 6 meses) para gráficos
    const sixMonthsAgo = new Date(monthRange.start);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const historicalSnapshot = await getTransactionsInRange(userId, sixMonthsAgo, monthRange.end);
    const historicalTransactions = historicalSnapshot.docs.map(doc => docToObject(doc));

    const monthlyTrends: Record<string, { income: number; expense: number }> = {};
    historicalTransactions.forEach((tx: any) => {
      const txDate = tx.occurredAt instanceof Date ? tx.occurredAt : new Date(tx.occurredAt);
      const key = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!monthlyTrends[key]) monthlyTrends[key] = { income: 0, expense: 0 };
      const converted = convert(tx.amountCents, tx.currencyCode);
      if (tx.type === "INCOME") monthlyTrends[key].income += converted;
      if (tx.type === "EXPENSE") monthlyTrends[key].expense += converted;
    });

    const chartData = Object.keys(monthlyTrends)
      .sort()
      .map(key => ({
        month: key,
        Ingresos: monthlyTrends[key].income / 100,
        Gastos: monthlyTrends[key].expense / 100,
        Balance: (monthlyTrends[key].income - monthlyTrends[key].expense) / 100
      }));

    // Comparación con mes anterior (solo si es mes actual)
    const today = new Date();
    const isCurrentMonth = today.getUTCFullYear() === monthRange.year && (today.getUTCMonth() + 1) === monthRange.month;
    let previousMonthData = null;

    if (isCurrentMonth) {
      const prevMonth = monthRange.month === 1 ? 12 : monthRange.month - 1;
      const prevYear = monthRange.month === 1 ? monthRange.year - 1 : monthRange.year;
      const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
      const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));
      const prevMonthSnapshot = await getTransactionsInRange(userId, prevMonthStart, prevMonthEnd);
      const prevTransactions = prevMonthSnapshot.docs.map(doc => docToObject(doc));

      const currentDay = today.getUTCDate();
      const prevMonthDay = Math.min(currentDay, prevMonthEnd.getUTCDate());
      const prevMonthExpenses = prevTransactions
        .filter((t: any) => {
          const occurredAt = t.occurredAt instanceof Date ? t.occurredAt : new Date(t.occurredAt);
          return t.type === "EXPENSE" && occurredAt.getUTCDate() <= prevMonthDay;
        })
        .reduce((sum: number, t: any) => sum + convert(t.amountCents, t.currencyCode), 0);

      previousMonthData = {
        spentUpToSameDay: prevMonthExpenses,
        month: prevMonth,
        year: prevYear
      };
    }

    const response = {
      budget: budget?.data,
      daily: {
        spentTodayCents,
        dailyBudgetCents,
        remainingTodayCents,
        dailyTargetTomorrowCents
      },
      month: {
        year: monthRange.year,
        month: monthRange.month,
        transactionCount: monthTransactions.length,
        totalIncomeCents,
        totalExpenseCents,
        balanceCents: totalIncomeCents - totalExpenseCents,
        availableBalanceCents,
        expensesByCategory
      },
      goal: {
        savingGoalCents,
        directedSavingsCents,
        progress: goalProgress,
        remainingCents: Math.max(0, savingGoalCents - directedSavingsCents)
      },
      chartData,
      previousMonthData,
      accounts,
      user: {
        id: userId,
        currencyCode: baseCurrency,
        locale: userData.locale || "en-US",
        timeZone: tz,
        defaultAccountId: userData.defaultAccountId || null,
        defaultCategoryId: userData.defaultCategoryId || null
      }
    };

    dashboardCache.set(cacheKey, { timestamp: now, data: response });
    res.json(response);
  } catch (error: any) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: error.message || "Error al obtener resumen de dashboard" });
  }
}
