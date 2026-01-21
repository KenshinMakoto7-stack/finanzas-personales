import { db } from "../lib/firebase.js";
import { monthRangeUTC, dayRangeUTC, cycleRangeUTC } from "../lib/time.js";
import { docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";
import { getExchangeRatesMap, convertAmountWithRate } from "./exchange.service.js";

/** Función pura: cálculo del promedio y rollover (todos en centavos) */
export function computeDailyBudgetWithRollover(params: {
  year: number;
  month: number;
  dayOfMonth: number;
  daysInMonth: number;
  totalIncomeCents: number;
  spentBeforeTodayCents: number;
  spentTodayCents: number;
  savingGoalCents: number;
}) {
  const { year, month, dayOfMonth, daysInMonth, totalIncomeCents, spentBeforeTodayCents, spentTodayCents, savingGoalCents } = params;

  const availableStartCents = totalIncomeCents - savingGoalCents - spentBeforeTodayCents;
  const remainingDaysIncludingToday = Math.max(daysInMonth - dayOfMonth + 1, 1);
  const dailyTargetTodayStartCents = Math.floor(availableStartCents / remainingDaysIncludingToday);

  const availableEndOfDayCents = availableStartCents - spentTodayCents;
  const rolloverFromTodayCents = Math.max(dailyTargetTodayStartCents - spentTodayCents, 0);

  const remainingDaysExcludingToday = Math.max(daysInMonth - dayOfMonth, 0);
  const dailyTargetTomorrowCents =
    remainingDaysExcludingToday > 0 ? Math.floor(availableEndOfDayCents / remainingDaysExcludingToday) : 0;

  const overspend = availableEndOfDayCents < 0;
  const overspendCents = overspend ? Math.abs(availableEndOfDayCents) : 0;

  return {
    month: { year, month, daysInMonth, today: dayOfMonth },
    startOfDay: {
      availableCents: availableStartCents,
      remainingDaysIncludingToday,
      dailyTargetCents: dailyTargetTodayStartCents
    },
    endOfDay: {
      availableCents: availableEndOfDayCents,
      remainingDaysExcludingToday,
      dailyTargetTomorrowCents,
      rolloverFromTodayCents
    },
    safety: { overspend, overspendCents }
  };
}

/** Servicio: calcula el resumen para el usuario en una fecha (respetando su TZ) */
export async function getBudgetSummaryForDate(
  userId: string,
  dateISO: string,
  userTimeZone: string,
  baseCurrency: string,
  budgetCycleDay?: number | null
) {
  try {
    const cycleRange = cycleRangeUTC(dateISO, userTimeZone, budgetCycleDay);
    const dayRange = dayRangeUTC(dateISO, userTimeZone);

    // Meta del mes (si no existe, 0)
    let savingGoalCents = 0;
    try {
      const monthDate = new Date(Date.UTC(cycleRange.year, cycleRange.month - 1, 1));
      const goalsSnapshot = await db.collection("monthlyGoals")
        .where("userId", "==", userId)
        .where("month", "==", Timestamp.fromDate(monthDate))
        .limit(1)
        .get();
      savingGoalCents = goalsSnapshot.empty ? 0 : (goalsSnapshot.docs[0].data().savingGoalCents as number || 0);
    } catch (e) {
      // Si falla la query de goals, usar 0
      savingGoalCents = 0;
    }

    // Obtener transacciones del mes con rango (más rápido que traer todo)
    const monthStartDate = cycleRange.start;
    const monthEndDate = cycleRange.end;

    const loadMonthTransactions = async () => {
      try {
        return await db.collection("transactions")
          .where("userId", "==", userId)
          .where("occurredAt", ">=", Timestamp.fromDate(monthStartDate))
          .where("occurredAt", "<=", Timestamp.fromDate(monthEndDate))
          .orderBy("occurredAt", "asc")
          .get();
      } catch (error: any) {
        // Fallback si falta índice compuesto
        const message = String(error?.message || "");
        if (message.includes("index") || message.includes("INDEX")) {
          return await db.collection("transactions")
            .where("userId", "==", userId)
            .get();
        }
        throw error;
      }
    };

    const allTransactionsSnapshot = await loadMonthTransactions();

    const monthStart = monthStartDate.getTime();
    const monthEnd = monthEndDate.getTime();
    const dayStart = dayRange.start.getTime();
    const dayEnd = dayRange.end.getTime();

    let totalIncomeCents = 0;
    let spentBeforeTodayCents = 0;
    let spentTodayCents = 0;

    const transactions = allTransactionsSnapshot.docs.map(doc => docToObject(doc));
    const uniqueCurrencies = [...new Set(transactions.map((t: any) => t.currencyCode).filter(Boolean))]
      .filter(c => c && c !== baseCurrency);
    const rateMap = await getExchangeRatesMap(uniqueCurrencies, baseCurrency);

    transactions.forEach((data: any) => {
      const occurredAt = data.occurredAt?.toDate?.() || new Date(data.occurredAt);
      const time = occurredAt.getTime();
      const amountCents = data.amountCents || 0;
      const converted = convertAmountWithRate(amountCents, data.currencyCode || baseCurrency, baseCurrency, rateMap);

      // Solo considerar transacciones del mes actual
      if (time >= monthStart && time <= monthEnd) {
        if (data.type === "INCOME") {
          totalIncomeCents += converted;
        } else if (data.type === "EXPENSE") {
          if (time < dayStart) {
            spentBeforeTodayCents += converted;
          } else if (time >= dayStart && time <= dayEnd) {
            spentTodayCents += converted;
          }
        }
      }
    });

    const daysInCycle = cycleRange.daysInMonth ?? 30;
    const dayOfCycle = Math.max(1, Math.floor((dayRange.start.getTime() - cycleRange.start.getTime()) / (24 * 60 * 60 * 1000)) + 1);

    const calc = computeDailyBudgetWithRollover({
      year: cycleRange.year,
      month: cycleRange.month,
      dayOfMonth: dayOfCycle,
      daysInMonth: daysInCycle,
      totalIncomeCents,
      spentBeforeTodayCents,
      spentTodayCents,
      savingGoalCents
    });

    const cycleDay = "cycleDay" in cycleRange ? cycleRange.cycleDay : (budgetCycleDay ?? null);
    return {
      params: { date: dateISO, timeZone: userTimeZone, budgetCycleDay: cycleDay },
      data: calc
    };
  } catch (error: any) {
    console.error("getBudgetSummaryForDate error:", error);
    // Retornar datos vacíos en caso de error
    return {
      params: { date: dateISO, timeZone: userTimeZone },
      data: computeDailyBudgetWithRollover({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        dayOfMonth: new Date().getDate(),
        daysInMonth: 30,
        totalIncomeCents: 0,
        spentBeforeTodayCents: 0,
        spentTodayCents: 0,
        savingGoalCents: 0
      })
    };
  }
}
