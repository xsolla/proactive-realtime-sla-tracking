export type MaintenanceWindow = {
  partnerSlug: string;
  /** Null covers every scope for the partner. */
  scopeId: string | null;
  start: Date;
  end: Date;
};

/**
 * No maintenance calendar is connected yet. Live runs therefore have nothing
 * to exclude. Callers can pass windows in tests and, later, from that calendar.
 */
export function loadMaintenanceWindows(): readonly MaintenanceWindow[] {
  return [];
}

export function isDuringExcludedMaintenance(
  asOf: Date,
  partnerSlug: string,
  scopeId: string,
  windows: readonly MaintenanceWindow[],
): boolean {
  const at = asOf.getTime();
  return windows.some((window) => {
    if (window.partnerSlug !== partnerSlug) {
      return false;
    }
    if (window.scopeId !== null && window.scopeId !== scopeId) {
      return false;
    }
    return window.start.getTime() <= at && at < window.end.getTime();
  });
}
