import { DateTime } from "luxon";

/** Retorna inicio y fin de día en TZ del usuario (en UTC) */
export function dayRangeUTC(dateISO: string, timeZone: string) {
  const d = DateTime.fromISO(dateISO, { zone: timeZone });
  const start = d.startOf("day").toUTC();
  const end = d.endOf("day").toUTC();
  return { start: start.toJSDate(), end: end.toJSDate(), dayOfMonth: d.day };
}

/** Retorna el primer y último día del MES de dateISO en TZ, en UTC, y días en el mes */
export function monthRangeUTC(dateISO: string, timeZone: string) {
  const d = DateTime.fromISO(dateISO, { zone: timeZone });
  const start = d.startOf("month").toUTC();
  const end = d.endOf("month").toUTC();
  return { start: start.toJSDate(), end: end.toJSDate(), year: d.year, month: d.month, daysInMonth: d.daysInMonth };
}

/** Convierte año/mes a primer día UTC (convención para MonthlyGoal) */
export function monthAnchorUTC(year: number, month: number) {
  return DateTime.utc(year, month, 1, 0, 0, 0).toJSDate();
}



