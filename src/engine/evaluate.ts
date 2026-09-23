import { DATA_COVERAGE_START, MIN_BASELINE_MONTHS, WINDOW_TIMEZONE } from "./constants";
import {
  durationMinutes,
  elapsedFraction,
  intersect,
  mergeIntervals,
  observedInterval,
  outageInterval,
  overlaps,
  windowMinutes,
  type Interval,
} from "./intervals";
import { capAt, penaltyFigure, rawCredit, scaleToAggregate, sharedAggregateCap } from "./penalty";
import { classify } from "./status";
import type {
  BaselineComparison,
  EngineTerms,
  Evaluation,
  OutageRef,
  PartnerScopes,
  SlaScope,
  UsableOutage,
  Window,
} from "./types";

type Attributed<P extends string, S extends string> = {
  outage: UsableOutage<P, S>;
  interval: Interval;
  minutes: number;
};

export function evaluate<P extends string, S extends string>(input: {
  outages: readonly UsableOutage<P, S>[];
  scopes: readonly PartnerScopes<P, S>[];
  window: Window;
  asOf: Date;
}): Evaluation<P, S>[] {
  assertInstants(input.window, input.asOf);
  const minutesInWindow = windowMinutes(input.window);
  const observed = observedInterval(input.window, input.asOf);
  const elapsed = elapsedFraction(input.window, input.asOf);
  const anchorMs = Math.min(input.asOf.getTime(), input.window.end.getTime());

  const scopesByPartner = new Map<P, SlaScope<S>[]>();
  const partnerOrder: P[] = [];
  const remember = (partnerId: P) => {
    if (!scopesByPartner.has(partnerId)) {
      scopesByPartner.set(partnerId, []);
      partnerOrder.push(partnerId);
    }
  };

  for (const entry of input.scopes) {
    remember(entry.partner);
    scopesByPartner.get(entry.partner)?.push(...entry.scopes);
  }
  for (const row of input.outages) {
    remember(row.partnerId);
  }

  const results: Evaluation<P, S>[] = [];
  for (const partnerId of partnerOrder) {
    const scopes = scopesByPartner.get(partnerId) ?? [];
    const partnerOutages = input.outages.filter((row) => row.partnerId === partnerId);
    const active = scopes.filter((scope) => scopeIsActive(scope, observed));
    if (active.length === 0) {
      results.push(...trackingRows(partnerId, partnerOutages, input.window, observed));
      continue;
    }
    results.push(
      ...scoredRows(
        partnerId,
        active,
        partnerOutages,
        input.window,
        observed,
        elapsed,
        minutesInWindow,
        anchorMs,
      ),
    );
  }
  return results;
}

function assertInstants(window: Window, asOf: Date): void {
  if (
    Number.isNaN(window.start.getTime()) ||
    Number.isNaN(window.end.getTime()) ||
    Number.isNaN(asOf.getTime())
  ) {
    throw new Error("Window and asOf must be valid instants.");
  }
  if (!(window.end.getTime() > window.start.getTime())) {
    throw new Error("Window end must be after window start.");
  }
}

function scopeIsActive(scope: SlaScope, observed: Interval | null): boolean {
  if (observed === null) {
    return false;
  }
  return overlaps(observed, effectiveInterval(scope.terms));
}

function effectiveInterval(terms: EngineTerms): Interval {
  return {
    startMs: terms.effectiveFrom.getTime(),
    endMs: terms.effectiveTo === null ? Number.POSITIVE_INFINITY : terms.effectiveTo.getTime() + 1,
  };
}

function scoredRows<P extends string, S extends string>(
  partnerId: P,
  scopes: readonly SlaScope<S>[],
  outages: readonly UsableOutage<P, S>[],
  window: Window,
  observed: Interval | null,
  elapsed: number,
  minutesInWindow: number,
  anchorMs: number,
): Evaluation<P, S>[] {
  for (const scope of scopes) {
    if (scope.terms.timezone !== WINDOW_TIMEZONE) {
      throw new Error(
        `Scope ${scope.scopeId} measures in ${scope.terms.timezone}. Evaluation uses ${WINDOW_TIMEZONE}.`,
      );
    }
  }

  const scopedServices = new Set<S>();
  for (const scope of scopes) {
    if (scope.kind === "service") {
      scopedServices.add(scope.service);
    }
  }

  const drafts = scopes.map((scope) => {
    // Downtime is clipped to the effective interval. Allowance stays the full window.
    const bounds =
      observed === null ? null : intersect(observed, effectiveInterval(scope.terms));
    const matching = outages.filter((row) => matchesScope(row, scope, scopedServices));
    const attributed = attribute(matching, bounds);
    const counted = countDowntime(attributed);
    const allowedMinutes = (1 - scope.terms.target) * minutesInWindow;
    const projectedMinutes = elapsed > 0 ? counted.usedMinutes / elapsed : counted.usedMinutes;
    return {
      scope,
      usedMinutes: counted.usedMinutes,
      allowedMinutes,
      merged: counted.merged,
      outages: refs(attributed),
      incurred: capAt(
        rawCredit(counted.usedMinutes, minutesInWindow, scope.terms.penaltyTiers),
        scope.terms.perScopeCap,
      ),
      projected: capAt(
        rawCredit(projectedMinutes, minutesInWindow, scope.terms.penaltyTiers),
        scope.terms.perScopeCap,
      ),
    };
  });

  const aggregateCap = sharedAggregateCap(scopes);
  const incurred = scaleToAggregate(
    drafts.map((draft) => draft.incurred),
    aggregateCap,
  );
  const projected = scaleToAggregate(
    drafts.map((draft) => draft.projected),
    aggregateCap,
  );

  return drafts.map((draft, index) => {
    const classification = classify({
      usedMinutes: draft.usedMinutes,
      allowedMinutes: draft.allowedMinutes,
      elapsedFraction: elapsed,
      windowMinutes: minutesInWindow,
      merged: draft.merged,
      anchorMs,
    });
    return {
      kind: "scored",
      partner: partnerId,
      scopeId: draft.scope.scopeId,
      target: draft.scope.terms.target,
      allowedMinutes: draft.allowedMinutes,
      usedMinutes: draft.usedMinutes,
      remainingMinutes: classification.remainingMinutes,
      burnRate: classification.reason.burnRate,
      status: classification.status,
      projectedExhaustion: classification.projectedExhaustion,
      penalty: {
        incurred: penaltyFigure(incurred[index] ?? 0, draft.scope.terms.monthlyFee),
        projected: penaltyFigure(projected[index] ?? 0, draft.scope.terms.monthlyFee),
      },
      reason: classification.reason,
      outages: draft.outages,
    };
  });
}

function matchesScope<P extends string, S extends string>(
  row: UsableOutage<P, S>,
  scope: SlaScope<S>,
  scopedServices: ReadonlySet<S>,
): boolean {
  if (scope.kind === "service") {
    return row.serviceId === scope.service;
  }
  if (scope.includesScopedServices) {
    return true;
  }
  return !scopedServices.has(row.serviceId);
}

function trackingRows<P extends string, S extends string>(
  partnerId: P,
  outages: readonly UsableOutage<P, S>[],
  window: Window,
  observed: Interval | null,
): Evaluation<P, S>[] {
  const byService = new Map<S, UsableOutage<P, S>[]>();
  for (const row of outages) {
    const list = byService.get(row.serviceId) ?? [];
    list.push(row);
    byService.set(row.serviceId, list);
  }

  const results: Evaluation<P, S>[] = [];
  for (const [service, serviceOutages] of byService) {
    const attributed = attribute(serviceOutages, observed);
    if (attributed.length === 0) {
      continue;
    }
    const usedMinutes = countDowntime(attributed).usedMinutes;
    results.push({
      kind: "tracking_only",
      partner: partnerId,
      service,
      usedMinutes,
      incidentCount: attributed.length,
      comparison: baseline(service, serviceOutages, window, usedMinutes, DATA_COVERAGE_START),
      outages: refs(attributed),
    });
  }
  return results;
}

const BASELINE_LOOKBACK_MONTHS = 6;

function baseline<P extends string, S extends string>(
  service: S,
  outages: readonly UsableOutage<P, S>[],
  window: Window,
  currentMinutes: number,
  coverageStart: string,
): BaselineComparison {
  const coverageStartMs = utcDateMs(coverageStart);
  const year = window.start.getUTCFullYear();
  const month = window.start.getUTCMonth();
  const totals: number[] = [];
  for (let delta = 1; delta <= BASELINE_LOOKBACK_MONTHS; delta += 1) {
    const monthInterval = {
      startMs: Date.UTC(year, month - delta, 1),
      endMs: Date.UTC(year, month - delta + 1, 1),
    };
    if (monthInterval.startMs < coverageStartMs) {
      continue;
    }
    const attributed = attribute(
      outages.filter((row) => row.serviceId === service),
      monthInterval,
    );
    totals.push(countDowntime(attributed).usedMinutes);
  }
  const coveredMonths = totals.length;
  const monthsWithDowntime = totals.filter((minutes) => minutes > 0).length;
  if (coveredMonths < MIN_BASELINE_MONTHS) {
    return { kind: "insufficient_history", coveredMonths, monthsWithDowntime };
  }
  if (monthsWithDowntime === 0) {
    return { kind: "no_prior_downtime", coveredMonths, monthsWithDowntime: 0 };
  }
  const medianMinutes = median(totals);
  return {
    kind: "compared",
    coveredMonths,
    monthsWithDowntime,
    medianMinutes,
    currentMinutes,
    versusMedian:
      currentMinutes > medianMinutes ? "above" : currentMinutes < medianMinutes ? "below" : "equal",
  };
}

function utcDateMs(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match === null) {
    throw new Error(`Coverage start must be YYYY-MM-DD, received ${isoDate}.`);
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function attribute<P extends string, S extends string>(
  outages: readonly UsableOutage<P, S>[],
  bounds: Interval | null,
): Attributed<P, S>[] {
  if (bounds === null) {
    return [];
  }
  const rows: Attributed<P, S>[] = [];
  for (const outage of outages) {
    if (!(outage.outageMinutes > 0)) {
      continue;
    }
    const full = outageInterval(outage.incidentStarted, outage.outageMinutes);
    const interval = intersect(full, bounds);
    if (interval === null) {
      continue;
    }
    const coversWholeOutage = interval.startMs === full.startMs && interval.endMs === full.endMs;
    rows.push({
      outage,
      interval,
      minutes: coversWholeOutage ? outage.outageMinutes : durationMinutes([interval]),
    });
  }
  rows.sort(
    (a, b) =>
      a.interval.startMs - b.interval.startMs || a.outage.pirKey.localeCompare(b.outage.pirKey),
  );
  return rows;
}

function countDowntime<P extends string, S extends string>(
  attributed: readonly Attributed<P, S>[],
): { usedMinutes: number; merged: Interval[] } {
  const merged = mergeIntervals(attributed.map((row) => row.interval));
  if (merged.length === attributed.length) {
    return {
      usedMinutes: attributed.reduce((sum, row) => sum + row.minutes, 0),
      merged,
    };
  }
  return { usedMinutes: durationMinutes(merged), merged };
}

function refs<P extends string, S extends string>(rows: readonly Attributed<P, S>[]): OutageRef<S>[] {
  let groupEnd = Number.NEGATIVE_INFINITY;
  let groupNumber = 0;
  let mergeGroup = "";
  return rows.map((row) => {
    let countedMinutes: number;
    if (row.interval.startMs > groupEnd) {
      groupNumber += 1;
      mergeGroup = String(groupNumber);
      groupEnd = row.interval.endMs;
      countedMinutes = row.minutes;
    } else {
      const extensionEnd = Math.max(groupEnd, row.interval.endMs);
      countedMinutes = durationMinutes([{ startMs: groupEnd, endMs: extensionEnd }]);
      groupEnd = extensionEnd;
    }
    return {
      pirKey: row.outage.pirKey,
      service: row.outage.serviceId,
      incidentStarted: row.outage.incidentStarted,
      minutes: row.minutes,
      mergeGroup,
      countedMinutes,
    };
  });
}
