import { DateTime } from "luxon";

/** Retorna inicio y fin de día en TZ del usuario (en UTC) */
export function dayRangeUTC(dateISO: string, timeZone: string) {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  const d = DateTime.fromISO(dateISO, { zone: tz });
  const start = d.startOf("day").toUTC();
  const end = d.endOf("day").toUTC();
  return { start: start.toJSDate(), end: end.toJSDate(), dayOfMonth: d.day };
}

/** Retorna el primer y último día del MES de dateISO en TZ, en UTC, y días en el mes */
export function monthRangeUTC(dateISO: string, timeZone: string) {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  const d = DateTime.fromISO(dateISO, { zone: tz });
  const start = d.startOf("month").toUTC();
  const end = d.endOf("month").toUTC();
  return { start: start.toJSDate(), end: end.toJSDate(), year: d.year, month: d.month, daysInMonth: d.daysInMonth };
}

/**
 * Retorna el rango de un ciclo de presupuesto basado en un día de cobro.
 * Si cycleDay no es válido, usa el mes calendario.
 */
export function cycleRangeUTC(dateISO: string, timeZone: string, cycleDay?: number | null) {
  if (!cycleDay || !Number.isFinite(cycleDay)) {
    return monthRangeUTC(dateISO, timeZone);
  }

  const day = Math.max(1, Math.min(28, Math.floor(cycleDay)));
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  const d = DateTime.fromISO(dateISO, { zone: tz });

  let start = d.set({ day }).startOf("day");
  if (d.day < day) {
    start = start.minus({ months: 1 }).set({ day }).startOf("day");
  }
  const end = start.plus({ months: 1 }).minus({ days: 1 }).endOf("day");

  const daysInCycle = Math.floor(end.diff(start, "days").days) + 1;
  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),
    year: start.year,
    month: start.month,
    daysInMonth: daysInCycle,
    cycleDay: day
  };
}

/** Convierte año/mes a primer día UTC (convención para MonthlyGoal) */
export function monthAnchorUTC(year: number, month: number) {
  return DateTime.utc(year, month, 1, 0, 0, 0).toJSDate();
}

/** Valida si un timezone es válido */
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    const dt = DateTime.now().setZone(tz);
    return dt.isValid && dt.zone.name !== "UTC+0"; // Luxon returns UTC+0 for invalid zones
  } catch {
    return false;
  }
}

/** Obtiene la fecha/hora actual en el timezone del usuario */
export function nowInTimezone(timeZone: string): DateTime {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  return DateTime.now().setZone(tz);
}

/** Convierte una fecha JS a ISO string en el timezone especificado */
export function toISOInTimezone(date: Date, timeZone: string): string {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  return DateTime.fromJSDate(date).setZone(tz).toISO() || date.toISOString();
}

/** Convierte un ISO string a Date, interpretándolo en el timezone especificado */
export function fromISOInTimezone(isoString: string, timeZone: string): Date {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  return DateTime.fromISO(isoString, { zone: tz }).toJSDate();
}

/** Formatea una fecha para mostrar al usuario en su timezone */
export function formatDateForUser(date: Date, timeZone: string, format: string = "yyyy-MM-dd HH:mm"): string {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  return DateTime.fromJSDate(date).setZone(tz).toFormat(format);
}

/** Obtiene el offset del timezone en formato "+HH:MM" o "-HH:MM" */
export function getTimezoneOffset(timeZone: string): string {
  const tz = isValidTimezone(timeZone) ? timeZone : "UTC";
  const dt = DateTime.now().setZone(tz);
  return dt.toFormat("ZZ"); // e.g., "-03:00"
}

/** Lista de timezones comunes para validación/selección */
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];



