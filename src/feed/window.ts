import type { Window } from "@/engine";

/** First UTC month present in sla_outages. There is no availability data before this. */
export const EARLIEST_DATA_MONTH = "2026-01";

/** UTC calendar month containing asOf. Inclusive start, exclusive end. */
export function calendarMonthWindow(asOf: Date): Window {
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export function monthKey(asOf: Date): string {
  return formatMonthKey(asOf.getUTCFullYear(), asOf.getUTCMonth());
}

/** Inclusive start, exclusive end. Null when the key is not a calendar month. */
export function windowFromMonthKey(key: string): Window | null {
  const parsed = parseMonthKey(key);
  if (parsed === null) {
    return null;
  }
  return {
    start: new Date(Date.UTC(parsed.year, parsed.month, 1)),
    end: new Date(Date.UTC(parsed.year, parsed.month + 1, 1)),
  };
}

/**
 * Closed windows are settled: the month has ended, and a late PIR can still move the figures.
 * A window that still contains asOf is open.
 */
export function windowPhase(window: Window, asOf: Date): "open" | "settled" {
  return window.end.getTime() <= asOf.getTime() ? "settled" : "open";
}

/** Months from the first data month through the UTC month containing asOf. */
export function monthKeysThrough(asOf: Date): string[] {
  const start = parseMonthKey(EARLIEST_DATA_MONTH);
  if (start === null) {
    return [];
  }
  const endYear = asOf.getUTCFullYear();
  const endMonth = asOf.getUTCMonth();
  if (endYear < start.year || (endYear === start.year && endMonth < start.month)) {
    return [EARLIEST_DATA_MONTH];
  }

  const keys: string[] = [];
  for (let year = start.year, month = start.month; year < endYear || (year === endYear && month <= endMonth); ) {
    keys.push(formatMonthKey(year, month));
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return keys;
}

/** Unknown, future, or pre-data keys fall back to the UTC month containing asOf. */
export function resolveDashboardWindow(requested: string | undefined, asOf: Date): { key: string; window: Window } {
  const currentKey = monthKey(asOf);
  const current = calendarMonthWindow(asOf);
  if (requested === undefined) {
    return { key: currentKey, window: current };
  }
  const allowed = new Set(monthKeysThrough(asOf));
  if (!allowed.has(requested)) {
    return { key: currentKey, window: current };
  }
  const window = windowFromMonthKey(requested);
  if (window === null) {
    return { key: currentKey, window: current };
  }
  return { key: requested, window };
}

function formatMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function parseMonthKey(key: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(year) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }
  return { year, month: monthNumber - 1 };
}
