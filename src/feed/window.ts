import type { Window } from "@/engine";

/** UTC calendar month containing asOf. Inclusive start, exclusive end. */
export function calendarMonthWindow(asOf: Date): Window {
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1)),
  };
}
