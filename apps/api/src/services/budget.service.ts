import { db } from "../lib/firebase.js";
import { monthRangeUTC, dayRangeUTC } from "../lib/time.js";
import { docToObject } from "../lib/firestore-helpers.js";
import { Timestamp } from "firebase-admin/firestore";

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
export async function getBudgetSummaryForDate(userId: string, dateISO: string, userTimeZone: string, year?: number, month?: number) {
  // Rango del mes y del día en UTC (a partir de dateISO interpretado en TZ)
  const monthRange = monthRangeUTC(dateISO, userTimeZone);
  const dayRange = dayRangeUTC(dateISO, userTimeZone);

  // Meta del mes (si no existe, 0)
  const monthDate = new Date(Date.UTC(monthRange.year, monthRange.month - 1, 1));
  const goalsSnapshot = await db.collection("monthlyGoals")
    .where("userId", "==", userId)
    .where("month", "==", Timestamp.fromDate(monthDate))
    .limit(1)
    .get();

  const savingGoalCents = goalsSnapshot.empty ? 0 : (goalsSnapshot.docs[0].data().savingGoalCents as number || 0);

  // Ingresos del mes
  const incomeSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("type", "==", "INCOME")
    .where("occurredAt", ">=", Timestamp.fromDate(monthRange.start))
    .where("occurredAt", "<=", Timestamp.fromDate(monthRange.end))
    .get();

  const totalIncomeCents = incomeSnapshot.docs.reduce((sum, doc) => {
    return sum + (doc.data().amountCents || 0);
  }, 0);

  // Gastos hasta ayer
  const spentBeforeSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("type", "==", "EXPENSE")
    .where("occurredAt", ">=", Timestamp.fromDate(monthRange.start))
    .where("occurredAt", "<", Timestamp.fromDate(dayRange.start))
    .get();

  const spentBeforeTodayCents = spentBeforeSnapshot.docs.reduce((sum, doc) => {
    return sum + (doc.data().amountCents || 0);
  }, 0);

  // Gastos de hoy
  const spentTodaySnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("type", "==", "EXPENSE")
    .where("occurredAt", ">=", Timestamp.fromDate(dayRange.start))
    .where("occurredAt", "<=", Timestamp.fromDate(dayRange.end))
    .get();

  const spentTodayCents = spentTodaySnapshot.docs.reduce((sum, doc) => {
    return sum + (doc.data().amountCents || 0);
  }, 0);

  const calc = computeDailyBudgetWithRollover({
    year: monthRange.year,
    month: monthRange.month,
    dayOfMonth: dayRange.dayOfMonth,
    daysInMonth: monthRange.daysInMonth ?? 30,
    totalIncomeCents,
    spentBeforeTodayCents,
    spentTodayCents,
    savingGoalCents
  });

  return { params: { date: dateISO, timeZone: userTimeZone }, data: calc };
}
