import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluate,
  HIGH_CONSUMPTION,
  MIN_CONSUMPTION,
  MIN_ELAPSED,
  WINDOW_TIMEZONE,
} from "@/engine";
import type {
  EngineTerms,
  Evaluation,
  PartnerScopes,
  SlaScope,
  UsableOutage,
  Window,
} from "@/engine";
import type { SlaScope as TermsScope } from "@/terms";

type TermsFeedTheEngine = TermsScope extends SlaScope ? true : never;
const termsFeedTheEngine: TermsFeedTheEngine = true;
void termsFeedTheEngine;

const MINUTE_MS = 60_000;

function monthWindow(year: number, monthIndex: number): Window {
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function atEnd(window: Window): Date {
  return new Date(window.end.getTime());
}

function terms(overrides: Partial<EngineTerms> = {}): EngineTerms {
  return {
    target: 0.999,
    window: "calendar_month",
    timezone: WINDOW_TIMEZONE,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    penaltyTiers: [
      { belowAvailability: 0.999, creditFraction: 0.1 },
      { belowAvailability: 0.99, creditFraction: 0.25 },
    ],
    perScopeCap: null,
    contractAggregateCap: null,
    monthlyFee: null,
    ...overrides,
  };
}

function serviceScope(
  scopeId: string,
  service: string,
  overrides: Partial<EngineTerms> = {},
): SlaScope {
  return { kind: "service", scopeId, service, terms: terms(overrides) };
}

function catchAll(
  scopeId: string,
  includesScopedServices: boolean,
  overrides: Partial<EngineTerms> = {},
): SlaScope {
  return { kind: "catch_all", scopeId, includesScopedServices, terms: terms(overrides) };
}

function outage(
  overrides: Partial<UsableOutage> &
    Pick<UsableOutage, "pirKey" | "incidentStarted" | "outageMinutes">,
): UsableOutage {
  return {
    partnerId: "scopely",
    serviceId: "payments",
    ...overrides,
  };
}

function partner(scopes: readonly SlaScope[], id = "scopely"): PartnerScopes {
  return { partner: id, scopes };
}

function expectScored(
  results: readonly Evaluation[],
  scopeId: string,
): Extract<Evaluation, { kind: "scored" }> {
  const row = results.find((result) => result.kind === "scored" && result.scopeId === scopeId);
  if (row === undefined || row.kind !== "scored") {
    throw new Error(`missing scored scope ${scopeId}`);
  }
  return row;
}

function engineSource(): string {
  const root = path.join(process.cwd(), "src/engine");
  const chunks: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".ts")) {
        chunks.push(readFileSync(full, "utf8"));
      }
    }
  };
  walk(root);
  return chunks.join("\n");
}

describe("evaluate", () => {
  it("does not read the wall clock", () => {
    const source = engineSource();
    expect(source).not.toMatch(/new Date\(\s*\)/);
    expect(source).not.toMatch(/Date\.now\(/);
  });

  it("apportions an outage at 23:40 on the final day as 20 minutes then 30", () => {
    const january = monthWindow(2026, 0);
    const february = monthWindow(2026, 1);
    const scopes = [partner([serviceScope("payments", "payments")])];
    const outages = [
      outage({
        pirKey: "PIR-BOUNDARY",
        incidentStarted: new Date(Date.UTC(2026, 0, 31, 23, 40)),
        outageMinutes: 50,
      }),
    ];

    const closing = expectScored(
      evaluate({ outages, scopes, window: january, asOf: atEnd(january) }),
      "payments",
    );
    const opening = expectScored(
      evaluate({ outages, scopes, window: february, asOf: atEnd(february) }),
      "payments",
    );

    expect(closing.usedMinutes).toBe(20);
    expect(opening.usedMinutes).toBe(30);
    expect(closing.outages).toEqual([
      expect.objectContaining({ pirKey: "PIR-BOUNDARY", minutes: 20 }),
    ]);
    expect(opening.outages).toEqual([
      expect.objectContaining({ pirKey: "PIR-BOUNDARY", minutes: 30 }),
    ]);
  });

  it("merges two overlapping PIRs in one scope and counts the downtime once", () => {
    const january = monthWindow(2026, 0);
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-A",
          incidentStarted: new Date(Date.UTC(2026, 0, 10, 0, 0)),
          outageMinutes: 100,
        }),
        outage({
          pirKey: "PIR-B",
          incidentStarted: new Date(Date.UTC(2026, 0, 10, 0, 40)),
          outageMinutes: 100,
        }),
        outage({
          partnerId: "niantic",
          pirKey: "PIR-OTHER",
          incidentStarted: new Date(Date.UTC(2026, 0, 10, 0, 0)),
          outageMinutes: 500,
        }),
      ],
      scopes: [partner([serviceScope("payments", "payments")])],
      window: january,
      asOf: atEnd(january),
    });

    const row = expectScored(results, "payments");
    expect(row.usedMinutes).toBe(140);
    expect(row.outages.map((item) => item.minutes).reduce((sum, minutes) => sum + minutes, 0)).toBe(
      200,
    );
    expect(row.outages.map((item) => item.pirKey).sort()).toEqual(["PIR-A", "PIR-B"]);
  });

  it("burns both allowances when a Payments outage is included in the catch-all", () => {
    const january = monthWindow(2026, 0);
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-PAY",
          incidentStarted: new Date(Date.UTC(2026, 0, 15, 12, 0)),
          outageMinutes: 50,
        }),
      ],
      scopes: [
        partner([
          serviceScope("payments", "payments"),
          catchAll("catch-all", true),
        ]),
      ],
      window: january,
      asOf: atEnd(january),
    });

    expect(expectScored(results, "payments").usedMinutes).toBe(50);
    expect(expectScored(results, "catch-all").usedMinutes).toBe(50);
    expect(expectScored(results, "payments").outages.map((item) => item.pirKey)).toEqual(["PIR-PAY"]);
    expect(expectScored(results, "catch-all").outages.map((item) => item.pirKey)).toEqual(["PIR-PAY"]);
  });

  it("burns only Payments when the catch-all excludes specifically scoped services", () => {
    const january = monthWindow(2026, 0);
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-PAY",
          incidentStarted: new Date(Date.UTC(2026, 0, 15, 12, 0)),
          outageMinutes: 50,
        }),
      ],
      scopes: [
        partner([
          serviceScope("payments", "payments"),
          catchAll("catch-all", false),
        ]),
      ],
      window: january,
      asOf: atEnd(january),
    });

    expect(expectScored(results, "payments").usedMinutes).toBe(50);
    expect(expectScored(results, "catch-all").usedMinutes).toBe(0);
    expect(expectScored(results, "catch-all").outages).toEqual([]);
  });

  it("still lets an unscoped service consume a catch-all that excludes scoped services", () => {
    const january = monthWindow(2026, 0);
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-PAY",
          incidentStarted: new Date(Date.UTC(2026, 0, 15, 12, 0)),
          outageMinutes: 50,
        }),
        outage({
          pirKey: "PIR-LOGIN",
          serviceId: "login",
          incidentStarted: new Date(Date.UTC(2026, 0, 16, 12, 0)),
          outageMinutes: 15,
        }),
      ],
      scopes: [
        partner([
          serviceScope("payments", "payments"),
          catchAll("catch-all", false),
        ]),
      ],
      window: january,
      asOf: atEnd(january),
    });

    expect(expectScored(results, "payments").usedMinutes).toBe(50);
    expect(expectScored(results, "catch-all").usedMinutes).toBe(15);
    expect(expectScored(results, "catch-all").outages.map((item) => item.service)).toEqual(["login"]);
  });

  it("breaches on day two when the allowance is exhausted, overriding both floors", () => {
    const january = monthWindow(2026, 0);
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-EARLY",
            incidentStarted: new Date(Date.UTC(2026, 0, 2, 0, 0)),
            outageMinutes: 60,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments")])],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 2, 12, 0)),
      }),
      "payments",
    );

    expect(row.status).toBe("breaching");
    expect(row.reason.rule).toBe("breaching");
    expect(row.reason.fired).toEqual([]);
    expect(row.reason.elapsedFraction).toBeLessThan(MIN_ELAPSED);
    expect(row.usedMinutes).toBe(60);
    expect(row.allowedMinutes).toBeCloseTo(44.64, 5);
    expect(row.remainingMinutes).toBe(0);
    expect(row.reason.usedMinutes).toBe(60);
    expect(row.reason.allowedMinutes).toBe(row.allowedMinutes);
  });

  it("stays meeting for a 90-second outage on day seven when the consumption floor is not met", () => {
    const january = monthWindow(2026, 0);
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-SHORT",
            incidentStarted: new Date(Date.UTC(2026, 0, 7, 10, 0)),
            outageMinutes: 1.5,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments")])],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 7, 12, 0)),
      }),
      "payments",
    );

    expect(row.status).toBe("meeting");
    expect(row.reason.rule).toBe("meeting");
    expect(row.reason.fired).toEqual([]);
    expect(row.usedMinutes).toBe(1.5);
    expect(row.reason.elapsedFraction).toBeGreaterThanOrEqual(MIN_ELAPSED);
    expect(row.reason.consumedFraction).not.toBeNull();
    expect(row.reason.consumedFraction as number).toBeLessThan(MIN_CONSUMPTION);
  });

  it("is at risk via the level trigger at 80% consumed on day 28 regardless of burn rate", () => {
    const january = monthWindow(2026, 0);
    const allowed = (1 - 0.999) * 31 * 24 * 60;
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-LEVEL",
            incidentStarted: new Date(Date.UTC(2026, 0, 1, 0, 0)),
            outageMinutes: allowed * 0.8,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments")])],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 28, 12, 0)),
      }),
      "payments",
    );

    expect(row.status).toBe("at_risk");
    expect(row.reason.rule).toBe("level");
    expect(row.reason.fired).toEqual(["level"]);
    expect(row.reason.consumedFraction).toBeCloseTo(0.8, 8);
    expect(row.reason.consumedFraction as number).toBeGreaterThanOrEqual(HIGH_CONSUMPTION);
    expect(row.reason.projectedMinutes).toBeLessThan(row.allowedMinutes);
    expect(row.reason.elapsedFraction).toBeGreaterThanOrEqual(MIN_ELAPSED);
    expect(row.burnRate).toBe(row.reason.burnRate);
    expect(row.burnRate).toBeCloseTo(0.8 / (27.5 / 31), 8);
  });

  it("handles a zero allowance without a division error", () => {
    const january = monthWindow(2026, 0);
    const withOutage = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-ZERO",
            incidentStarted: new Date(Date.UTC(2026, 0, 4, 0, 0)),
            outageMinutes: 5,
          }),
        ],
        scopes: [
          partner([
            serviceScope("zero", "payments", {
              target: 1,
              penaltyTiers: [{ belowAvailability: 1, creditFraction: 0.1 }],
            }),
          ]),
        ],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 15, 0, 0)),
      }),
      "zero",
    );

    expect(withOutage.allowedMinutes).toBe(0);
    expect(withOutage.usedMinutes).toBe(5);
    expect(withOutage.status).toBe("breaching");
    expect(withOutage.reason.consumedFraction).toBeNull();
    expect(Number.isFinite(withOutage.burnRate)).toBe(true);
    expect(Number.isFinite(withOutage.remainingMinutes)).toBe(true);
    expect(Number.isFinite(withOutage.penalty.incurred.creditFraction)).toBe(true);
    expect(Number.isFinite(withOutage.penalty.projected.creditFraction)).toBe(true);

    const clean = expectScored(
      evaluate({
        outages: [],
        scopes: [partner([serviceScope("zero-clean", "payments", { target: 1 })])],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 15, 0, 0)),
      }),
      "zero-clean",
    );

    expect(clean.allowedMinutes).toBe(0);
    expect(clean.usedMinutes).toBe(0);
    // Section 7.4 writes breaching as used >= allowed, which includes 0 >= 0.
    expect(clean.status).toBe("breaching");
    expect(clean.reason.consumedFraction).toBeNull();
    expect(Number.isFinite(clean.burnRate)).toBe(true);
    expect(Number.isFinite(clean.penalty.incurred.creditFraction)).toBe(true);
    expect(Number.isFinite(clean.penalty.projected.creditFraction)).toBe(true);
  });

  it("produces no January or February exposure for terms effective from March", () => {
    const marchTerms = { effectiveFrom: new Date("2026-03-01T00:00:00.000Z") };
    for (const [label, window] of [
      ["january", monthWindow(2026, 0)],
      ["february", monthWindow(2026, 1)],
    ] as const) {
      const results = evaluate({
        outages: [
          outage({
            pirKey: `PIR-${label}`,
            incidentStarted: new Date(window.start.getTime() + 10 * 24 * 60 * MINUTE_MS),
            outageMinutes: 1000,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments", marchTerms)])],
        window,
        asOf: atEnd(window),
      });

      expect(results.some((result) => result.kind === "scored")).toBe(false);
      expect(results.every((result) => result.kind === "tracking_only")).toBe(true);
      for (const result of results) {
        expect(Object.hasOwn(result, "status")).toBe(false);
        expect(Object.hasOwn(result, "penalty")).toBe(false);
        expect(Object.hasOwn(result, "target")).toBe(false);
      }
      const tracking = results.find((result) => result.kind === "tracking_only");
      if (tracking === undefined || tracking.kind !== "tracking_only") {
        throw new Error(`missing tracking row for ${label}`);
      }
      expect(tracking.usedMinutes).toBe(1000);
      expect(tracking.service).toBe("payments");
    }

    const march = monthWindow(2026, 2);
    const scored = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-MARCH",
            incidentStarted: new Date(Date.UTC(2026, 2, 10, 0, 0)),
            outageMinutes: 1000,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments", marchTerms)])],
        window: march,
        asOf: atEnd(march),
      }),
      "payments",
    );
    expect(scored.usedMinutes).toBe(1000);
    expect(scored.kind).toBe("scored");
  });

  it("omits status on a tracking-only result", () => {
    const january = monthWindow(2026, 0);
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-1",
          serviceId: "payments",
          incidentStarted: new Date(Date.UTC(2026, 0, 5, 0, 0)),
          outageMinutes: 12,
        }),
        outage({
          pirKey: "PIR-2",
          serviceId: "login",
          incidentStarted: new Date(Date.UTC(2026, 0, 6, 0, 0)),
          outageMinutes: 4,
        }),
      ],
      scopes: [partner([])],
      window: january,
      asOf: atEnd(january),
    });

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.kind).toBe("tracking_only");
      expect(Object.keys(result)).not.toContain("status");
    }
  });

  it("clips an in-progress outage at asOf", () => {
    const january = monthWindow(2026, 0);
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-OPEN",
            incidentStarted: new Date(Date.UTC(2026, 0, 10, 0, 0)),
            outageMinutes: 120,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments")])],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 10, 0, 30)),
      }),
      "payments",
    );

    expect(row.usedMinutes).toBe(30);
  });

  it("allows 43.2 minutes for a 99.9% target in a 30-day month", () => {
    const april = monthWindow(2026, 3);
    const row = expectScored(
      evaluate({
        outages: [],
        scopes: [partner([serviceScope("payments", "payments", { target: 0.999 })])],
        window: april,
        asOf: atEnd(april),
      }),
      "payments",
    );

    expect(row.allowedMinutes).toBeCloseTo(43.2, 8);
    expect(row.status).toBe("meeting");
    expect(row.usedMinutes).toBe(0);
  });

  it("breaches when used minutes equal the allowance", () => {
    const april = monthWindow(2026, 3);
    const allowed = (1 - 0.999) * 30 * 24 * 60;
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-EQ",
            incidentStarted: new Date(Date.UTC(2026, 3, 2, 0, 0)),
            outageMinutes: allowed,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments")])],
        window: april,
        asOf: atEnd(april),
      }),
      "payments",
    );

    expect(row.usedMinutes).toBeCloseTo(row.allowedMinutes, 8);
    expect(row.status).toBe("breaching");
    expect(row.reason.rule).toBe("breaching");
  });

  it("fires the level trigger on day two without the elapsed floor", () => {
    const january = monthWindow(2026, 0);
    const allowed = (1 - 0.999) * 31 * 24 * 60;
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-EARLY-LEVEL",
            incidentStarted: new Date(Date.UTC(2026, 0, 2, 0, 0)),
            outageMinutes: allowed * 0.8,
          }),
        ],
        scopes: [partner([serviceScope("payments", "payments")])],
        window: january,
        asOf: new Date(Date.UTC(2026, 0, 2, 12, 0)),
      }),
      "payments",
    );

    expect(row.usedMinutes).toBeLessThan(row.allowedMinutes);
    expect(row.reason.elapsedFraction).toBeLessThan(MIN_ELAPSED);
    expect(row.status).toBe("at_risk");
    expect(row.reason.rule).toBe("level");
    expect(row.reason.fired).toEqual(["level"]);
  });

  it("records trend and level together and names trend when both match", () => {
    const start = new Date("2026-05-01T00:00:00.000Z");
    const window = { start, end: new Date(start.getTime() + 10_000 * MINUTE_MS) };
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-BOTH",
            incidentStarted: start,
            outageMinutes: 80,
          }),
        ],
        scopes: [
          partner([
            serviceScope("payments", "payments", {
              target: 0.99,
              penaltyTiers: [{ belowAvailability: 0.99, creditFraction: 0.1 }],
            }),
          ]),
        ],
        window,
        asOf: new Date(start.getTime() + 5_000 * MINUTE_MS),
      }),
      "payments",
    );

    expect(row.allowedMinutes).toBeCloseTo(100, 8);
    expect(row.usedMinutes).toBe(80);
    expect(row.status).toBe("at_risk");
    expect(row.reason.rule).toBe("trend");
    expect(row.reason.fired).toEqual(["trend", "level"]);
    expect(row.burnRate).toBeCloseTo(1.6, 8);
    expect(row.projectedExhaustion?.getTime()).toBeCloseTo(start.getTime() + 6_250 * MINUTE_MS, -1);
  });

  it("projects exhaustion from the month-to-date burn when the allowance remains", () => {
    const start = new Date("2026-05-01T00:00:00.000Z");
    const window = { start, end: new Date(start.getTime() + 1_000 * MINUTE_MS) };
    const asOf = new Date(start.getTime() + 100 * MINUTE_MS);
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-PACE",
            incidentStarted: start,
            outageMinutes: 4,
          }),
        ],
        scopes: [
          partner([
            serviceScope("payments", "payments", {
              target: 0.99,
              penaltyTiers: [],
            }),
          ]),
        ],
        window,
        asOf,
      }),
      "payments",
    );

    expect(row.status).toBe("meeting");
    expect(row.projectedExhaustion?.getTime()).toBeCloseTo(asOf.getTime() + 150 * MINUTE_MS, -1);
  });

  it("keeps incurred and projected credits separate and takes the worst tier crossed", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const window = { start, end: new Date(start.getTime() + 10_000 * MINUTE_MS) };
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-TIER",
            incidentStarted: start,
            outageMinutes: 50,
          }),
        ],
        scopes: [
          partner([
            serviceScope("payments", "payments", {
              target: 0.99,
              penaltyTiers: [
                { belowAvailability: 0.99, creditFraction: 0.25 },
                { belowAvailability: 0.999, creditFraction: 0.1 },
              ],
              monthlyFee: { amount: 10_000, currency: "XXX" },
            }),
          ]),
        ],
        window,
        asOf: new Date(start.getTime() + 2_000 * MINUTE_MS),
      }),
      "payments",
    );

    expect(Object.keys(row.penalty).sort()).toEqual(["incurred", "projected"]);
    expect(row.penalty.incurred.creditFraction).toBeCloseTo(0.1, 8);
    expect(row.penalty.projected.creditFraction).toBeCloseTo(0.25, 8);
    expect(row.penalty.incurred.amount).toEqual({ amount: 1000, currency: "XXX" });
    expect(row.penalty.projected.amount).toEqual({ amount: 2500, currency: "XXX" });
  });

  it("does not cross a tier when availability equals belowAvailability", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const window = { start, end: new Date(start.getTime() + 10_000 * MINUTE_MS) };
    const row = expectScored(
      evaluate({
        outages: [
          outage({
            pirKey: "PIR-EDGE",
            incidentStarted: start,
            outageMinutes: 100,
          }),
        ],
        scopes: [
          partner([
            serviceScope("payments", "payments", {
              target: 0.9,
              penaltyTiers: [{ belowAvailability: 0.99, creditFraction: 0.1 }],
            }),
          ]),
        ],
        window,
        asOf: atEnd(window),
      }),
      "payments",
    );

    expect(row.penalty.incurred.creditFraction).toBe(0);
    expect(row.penalty.incurred.amount).toBeNull();
    expect(row.penalty.projected.creditFraction).toBe(0);
    expect(row.penalty.projected.amount).toBeNull();
  });

  it("applies the per-scope cap before reporting currency", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const window = { start, end: new Date(start.getTime() + 10_000 * MINUTE_MS) };
    const results = evaluate({
        outages: [
          outage({
            pirKey: "PIR-CAP-PAY",
            serviceId: "payments",
            incidentStarted: start,
            outageMinutes: 600,
          }),
          outage({
            pirKey: "PIR-CAP-LOGIN",
            serviceId: "login",
            incidentStarted: start,
            outageMinutes: 600,
          }),
        ],
      scopes: [
        partner([
          serviceScope("fee", "payments", {
            target: 0.9,
            penaltyTiers: [{ belowAvailability: 0.99, creditFraction: 0.5 }],
            perScopeCap: 0.3,
            monthlyFee: { amount: 10_000, currency: "XXX" },
          }),
          serviceScope("no-fee", "login", {
            target: 0.9,
            penaltyTiers: [{ belowAvailability: 0.99, creditFraction: 0.5 }],
            perScopeCap: 0.3,
            monthlyFee: null,
          }),
        ]),
      ],
      window,
      asOf: atEnd(window),
    });

    const fee = expectScored(results, "fee");
    const noFee = expectScored(results, "no-fee");
    expect(fee.penalty.incurred.creditFraction).toBeCloseTo(0.3, 8);
    expect(fee.penalty.projected.creditFraction).toBeCloseTo(0.3, 8);
    expect(fee.penalty.incurred.amount).toEqual({ amount: 3000, currency: "XXX" });
    expect(noFee.penalty.incurred.creditFraction).toBeCloseTo(0.3, 8);
    expect(noFee.penalty.incurred.amount).toBeNull();
    expect(noFee.penalty.projected.amount).toBeNull();
  });

  it("caps each scope proportionally after the per-scope cap, incurred and projected apart", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const window = { start, end: new Date(start.getTime() + 10_000 * MINUTE_MS) };
    const asOf = new Date(start.getTime() + 2_000 * MINUTE_MS);
    const shared = {
      target: 0.99,
      penaltyTiers: [
        { belowAvailability: 0.99, creditFraction: 0.2 },
        { belowAvailability: 0.9, creditFraction: 0.5 },
      ],
      perScopeCap: null,
      contractAggregateCap: 0.5,
      monthlyFee: null,
    } as const;
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-PAY",
          serviceId: "payments",
          incidentStarted: start,
          outageMinutes: 250,
        }),
        outage({
          pirKey: "PIR-LOGIN",
          serviceId: "login",
          incidentStarted: start,
          outageMinutes: 250,
        }),
      ],
      scopes: [
        partner([
          serviceScope("payments", "payments", shared),
          serviceScope("login", "login", shared),
        ]),
      ],
      window,
      asOf,
    });

    const payments = expectScored(results, "payments");
    const login = expectScored(results, "login");
    expect(payments.penalty.incurred.creditFraction).toBeCloseTo(0.2, 8);
    expect(login.penalty.incurred.creditFraction).toBeCloseTo(0.2, 8);
    expect(payments.penalty.projected.creditFraction).toBeCloseTo(0.25, 8);
    expect(login.penalty.projected.creditFraction).toBeCloseTo(0.25, 8);
    expect(payments.penalty.incurred.amount).toBeNull();
    expect(payments.penalty.projected.amount).toBeNull();
  });

  it("splits an aggregate cap in proportion to each scope's own credit", () => {
    const january = monthWindow(2026, 0);
    const results = evaluate({
      outages: [
        outage({
          pirKey: "PIR-PAY",
          serviceId: "payments",
          incidentStarted: new Date(Date.UTC(2026, 0, 10, 0, 0)),
          outageMinutes: 60,
        }),
        outage({
          pirKey: "PIR-LOGIN",
          serviceId: "login",
          incidentStarted: new Date(Date.UTC(2026, 0, 10, 0, 0)),
          outageMinutes: 60,
        }),
      ],
      scopes: [
        partner([
          serviceScope("payments", "payments", {
            penaltyTiers: [{ belowAvailability: 0.999, creditFraction: 0.3 }],
            contractAggregateCap: 0.2,
          }),
          serviceScope("login", "login", {
            penaltyTiers: [{ belowAvailability: 0.999, creditFraction: 0.1 }],
            contractAggregateCap: 0.2,
          }),
        ]),
      ],
      window: january,
      asOf: atEnd(january),
    });

    expect(expectScored(results, "payments").penalty.incurred.creditFraction).toBeCloseTo(0.15, 8);
    expect(expectScored(results, "login").penalty.incurred.creditFraction).toBeCloseTo(0.05, 8);
  });

  it("compares tracking downtime with the median of the six preceding UTC months", () => {
    const january = monthWindow(2026, 0);
    const priorMinutes = [10, 20, 30, 40, 50, 60];
    const outages = priorMinutes.map((minutes, index) =>
      outage({
        pirKey: `PIR-PRIOR-${index}`,
        incidentStarted: new Date(Date.UTC(2025, 6 + index, 15, 0, 0)),
        outageMinutes: minutes,
      }),
    );
    outages.push(
      outage({
        pirKey: "PIR-CURRENT",
        incidentStarted: new Date(Date.UTC(2026, 0, 15, 0, 0)),
        outageMinutes: 50,
      }),
    );

    const results = evaluate({
      outages,
      scopes: [partner([])],
      window: january,
      asOf: atEnd(january),
    });
    const row = results.find((result) => result.kind === "tracking_only");
    if (row === undefined || row.kind !== "tracking_only") {
      throw new Error("missing tracking row");
    }

    expect(row.comparison.months).toBe(6);
    expect(row.comparison.currentMinutes).toBe(50);
    expect(row.comparison.medianMinutes).toBe(35);
    expect(row.comparison.versusMedian).toBe("above");
    expect(row.incidentCount).toBe(1);
    expect(Object.hasOwn(row, "status")).toBe(false);
  });

  it("rejects a scope that is not measured in UTC", () => {
    const january = monthWindow(2026, 0);
    expect(() =>
      evaluate({
        outages: [],
        scopes: [
          partner([
            serviceScope("payments", "payments", { timezone: "America/Los_Angeles" }),
          ]),
        ],
        window: january,
        asOf: atEnd(january),
      }),
    ).toThrow(/UTC/);
  });
});
