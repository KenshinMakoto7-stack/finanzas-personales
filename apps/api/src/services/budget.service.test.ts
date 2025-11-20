import { describe, it, expect } from "vitest";
import { computeDailyBudgetWithRollover } from "./budget.service.js";

describe("computeDailyBudgetWithRollover", () => {
  it("calcula promedio y rollover", () => {
    const res = computeDailyBudgetWithRollover({
      year: 2025, month: 11, dayOfMonth: 18, daysInMonth: 30,
      totalIncomeCents: 300000,
      savingGoalCents: 30000,
      spentBeforeTodayCents: 120000,
      spentTodayCents: 3000
    });
    expect(res.startOfDay.availableCents).toBe(150000);
    expect(res.startOfDay.dailyTargetCents).toBe(11538);   // floor(150000/13)
    expect(res.endOfDay.availableCents).toBe(147000);
    expect(res.endOfDay.dailyTargetTomorrowCents).toBe(12250);
    expect(res.endOfDay.rolloverFromTodayCents).toBe(8538);
  });
});



