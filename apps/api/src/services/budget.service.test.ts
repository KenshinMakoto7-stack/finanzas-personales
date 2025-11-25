import { describe, it, expect } from "vitest";

// Test de la lógica de cálculo de presupuesto (sin importar el módulo que usa Firebase)
// La función computeDailyBudgetWithRollover calcula:
// - availableCents = totalIncomeCents - savingGoalCents - spentBeforeTodayCents
// - dailyTargetCents = floor(availableCents / daysRemaining)
// - rollover = dailyTargetCents - spentTodayCents

function computeDailyBudgetWithRollover(params: {
  year: number;
  month: number;
  dayOfMonth: number;
  daysInMonth: number;
  totalIncomeCents: number;
  savingGoalCents: number;
  spentBeforeTodayCents: number;
  spentTodayCents: number;
}) {
  const {
    dayOfMonth,
    daysInMonth,
    totalIncomeCents,
    savingGoalCents,
    spentBeforeTodayCents,
    spentTodayCents,
  } = params;

  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const daysRemainingTomorrow = daysRemaining - 1;

  // Al inicio del día
  const availableCentsStartOfDay = totalIncomeCents - savingGoalCents - spentBeforeTodayCents;
  const dailyTargetCents = Math.floor(availableCentsStartOfDay / daysRemaining);

  // Al final del día
  const availableCentsEndOfDay = availableCentsStartOfDay - spentTodayCents;
  const dailyTargetTomorrowCents = daysRemainingTomorrow > 0
    ? Math.floor(availableCentsEndOfDay / daysRemainingTomorrow)
    : 0;
  const rolloverFromTodayCents = dailyTargetCents - spentTodayCents;

  return {
    startOfDay: {
      availableCents: availableCentsStartOfDay,
      dailyTargetCents,
    },
    endOfDay: {
      availableCents: availableCentsEndOfDay,
      dailyTargetTomorrowCents,
      rolloverFromTodayCents,
    },
  };
}

describe("computeDailyBudgetWithRollover", () => {
  it("calcula promedio y rollover correctamente", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025,
      month: 11,
      dayOfMonth: 18,
      daysInMonth: 30,
      totalIncomeCents: 300000,
      savingGoalCents: 30000,
      spentBeforeTodayCents: 120000,
      spentTodayCents: 3000,
    });

    // availableCents = 300000 - 30000 - 120000 = 150000
    expect(res.startOfDay.availableCents).toBe(150000);

    // daysRemaining = 30 - 18 + 1 = 13
    // dailyTargetCents = floor(150000/13) = 11538
    expect(res.startOfDay.dailyTargetCents).toBe(11538);

    // availableCentsEndOfDay = 150000 - 3000 = 147000
    expect(res.endOfDay.availableCents).toBe(147000);

    // daysRemainingTomorrow = 12
    // dailyTargetTomorrowCents = floor(147000/12) = 12250
    expect(res.endOfDay.dailyTargetTomorrowCents).toBe(12250);

    // rolloverFromTodayCents = 11538 - 3000 = 8538
    expect(res.endOfDay.rolloverFromTodayCents).toBe(8538);
  });

  it("maneja caso de último día del mes", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025,
      month: 11,
      dayOfMonth: 30,
      daysInMonth: 30,
      totalIncomeCents: 100000,
      savingGoalCents: 10000,
      spentBeforeTodayCents: 80000,
      spentTodayCents: 5000,
    });

    // availableCents = 100000 - 10000 - 80000 = 10000
    expect(res.startOfDay.availableCents).toBe(10000);

    // daysRemaining = 1
    // dailyTargetCents = 10000
    expect(res.startOfDay.dailyTargetCents).toBe(10000);

    // No hay mañana
    expect(res.endOfDay.dailyTargetTomorrowCents).toBe(0);
  });

  it("maneja caso de primer día del mes", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025,
      month: 11,
      dayOfMonth: 1,
      daysInMonth: 30,
      totalIncomeCents: 300000,
      savingGoalCents: 30000,
      spentBeforeTodayCents: 0,
      spentTodayCents: 10000,
    });

    // availableCents = 300000 - 30000 - 0 = 270000
    expect(res.startOfDay.availableCents).toBe(270000);

    // daysRemaining = 30
    // dailyTargetCents = floor(270000/30) = 9000
    expect(res.startOfDay.dailyTargetCents).toBe(9000);
  });

  it("maneja rollover negativo cuando se gasta más del target", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025,
      month: 11,
      dayOfMonth: 15,
      daysInMonth: 30,
      totalIncomeCents: 100000,
      savingGoalCents: 10000,
      spentBeforeTodayCents: 50000,
      spentTodayCents: 5000, // Más que el target diario
    });

    // availableCents = 100000 - 10000 - 50000 = 40000
    expect(res.startOfDay.availableCents).toBe(40000);

    // daysRemaining = 16
    // dailyTargetCents = floor(40000/16) = 2500
    expect(res.startOfDay.dailyTargetCents).toBe(2500);

    // rollover = 2500 - 5000 = -2500 (negativo porque gastó de más)
    expect(res.endOfDay.rolloverFromTodayCents).toBe(-2500);
  });

  it("maneja meta de ahorro cero", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025,
      month: 11,
      dayOfMonth: 10,
      daysInMonth: 30,
      totalIncomeCents: 100000,
      savingGoalCents: 0,
      spentBeforeTodayCents: 30000,
      spentTodayCents: 2000,
    });

    // availableCents = 100000 - 0 - 30000 = 70000
    expect(res.startOfDay.availableCents).toBe(70000);
  });
});
