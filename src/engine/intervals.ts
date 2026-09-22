import type { Window } from "./types";

const MINUTE_MS = 60_000;

export type Interval = {
  startMs: number;
  endMs: number;
};

/** Instant from a timestamp derived from the inputs. Does not read the clock. */
export function fromMs(ms: number): Date {
  return new Date(ms);
}

export function elapsedFraction(window: Window, asOf: Date): number {
  const startMs = window.start.getTime();
  const span = window.end.getTime() - startMs;
  if (!(span > 0)) {
    return 0;
  }
  const elapsed = asOf.getTime() - startMs;
  if (elapsed <= 0) {
    return 0;
  }
  if (elapsed >= span) {
    return 1;
  }
  return elapsed / span;
}

export function windowMinutes(window: Window): number {
  return (window.end.getTime() - window.start.getTime()) / MINUTE_MS;
}

export function outageInterval(incidentStarted: Date, outageMinutes: number): Interval {
  const startMs = incidentStarted.getTime();
  return { startMs, endMs: startMs + outageMinutes * MINUTE_MS };
}

export function intersect(left: Interval, right: Interval): Interval | null {
  const startMs = Math.max(left.startMs, right.startMs);
  const endMs = Math.min(left.endMs, right.endMs);
  if (!(endMs > startMs)) {
    return null;
  }
  return { startMs, endMs };
}

export function overlaps(left: Interval, right: Interval): boolean {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last === undefined || interval.startMs > last.endMs) {
      merged.push({ startMs: interval.startMs, endMs: interval.endMs });
    } else if (interval.endMs > last.endMs) {
      last.endMs = interval.endMs;
    }
  }
  return merged;
}

export function durationMinutes(intervals: readonly Interval[]): number {
  return intervals.reduce((sum, interval) => sum + (interval.endMs - interval.startMs) / MINUTE_MS, 0);
}

export function observedInterval(window: Window, asOf: Date): Interval | null {
  const startMs = window.start.getTime();
  const endMs = Math.min(window.end.getTime(), asOf.getTime());
  if (!(endMs > startMs)) {
    return null;
  }
  return { startMs, endMs };
}
