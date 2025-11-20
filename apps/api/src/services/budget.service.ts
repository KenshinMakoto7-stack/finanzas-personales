import { prisma } from "../lib/db.js";
import { monthRangeUTC, dayRangeUTC } from "../lib/time.js";

/** Función pura: cálculo del promedio y rollover (todos en centavos) */
export function computeDailyBudgetWithRollover(params: {
  year: number;
  month: number;                // 1..12
  dayOfMonth: number;           // 1..31 según mes
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
  const goal = await prisma.monthlyGoal.findUnique({
    where: { userId_month: { userId, month: new Date(Date.UTC(monthRange.year, monthRange.month - 1, 1)) } }
  });
  const savingGoalCents = goal?.savingGoalCents ?? 0;

  // Ingresos del mes
  const incomesAgg = await prisma.transaction.aggregate({
    _sum: { amountCents: true },
    where: { userId, type: "INCOME", occurredAt: { gte: monthRange.start, lte: monthRange.end } }
  });
  const totalIncomeCents = incomesAgg._sum.amountCents ?? 0;

  // Gastos hasta ayer
  const spentBeforeAgg = await prisma.transaction.aggregate({
    _sum: { amountCents: true },
    where: { userId, type: "EXPENSE", occurredAt: { gte: monthRange.start, lt: dayRange.start } }
  });
  const spentBeforeTodayCents = spentBeforeAgg._sum.amountCents ?? 0;

  // Gastos de hoy
  const spentTodayAgg = await prisma.transaction.aggregate({
    _sum: { amountCents: true },
    where: { userId, type: "EXPENSE", occurredAt: { gte: dayRange.start, lte: dayRange.end } }
  });
  const spentTodayCents = spentTodayAgg._sum.amountCents ?? 0;

  const calc = computeDailyBudgetWithRollover({
    year: monthRange.year,
    month: monthRange.month,
    dayOfMonth: dayRange.dayOfMonth,
    daysInMonth: monthRange.daysInMonth,
    totalIncomeCents,
    spentBeforeTodayCents,
    spentTodayCents,
    savingGoalCents
  });

  return { params: { date: dateISO, timeZone: userTimeZone }, data: calc };
}



