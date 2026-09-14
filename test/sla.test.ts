import { describe, expect, it } from "vitest";
import { AT_RISK_THRESHOLD, evaluateSla, summarize } from "../src/sla.js";
import type { SlaCommitment, SlaEvaluation } from "../src/types.js";

const MINUTE = 60_000;
const NOW = 1_700_000_000_000;

function commitment(overrides: Partial<SlaCommitment> = {}): SlaCommitment {
  return {
    id: "c1",
    partnerId: "acme",
    subject: "Test issue",
    priority: "P2",
    openedAt: NOW,
    targetMinutes: 60,
    resolvedAt: null,
    ...overrides,
  };
}

describe("evaluateSla", () => {
  it("reports on_track when little of the budget is used", () => {
    const c = commitment({ openedAt: NOW - 10 * MINUTE, targetMinutes: 60 });
    const evaluation = evaluateSla(c, NOW);
    expect(evaluation.status).toBe("on_track");
    expect(evaluation.percentUsed).toBeCloseTo(10 / 60, 5);
    expect(evaluation.remainingMs).toBe(50 * MINUTE);
  });

  it("reports at_risk at or above the threshold but before the deadline", () => {
    const c = commitment({ openedAt: NOW - 50 * MINUTE, targetMinutes: 60 });
    const evaluation = evaluateSla(c, NOW);
    expect(evaluation.status).toBe("at_risk");
    expect(evaluation.percentUsed).toBeGreaterThanOrEqual(AT_RISK_THRESHOLD);
    expect(evaluation.remainingMs).toBeGreaterThan(0);
  });

  it("reports breaching once past the deadline while still open", () => {
    const c = commitment({ openedAt: NOW - 90 * MINUTE, targetMinutes: 60 });
    const evaluation = evaluateSla(c, NOW);
    expect(evaluation.status).toBe("breaching");
    expect(evaluation.remainingMs).toBeLessThan(0);
  });

  it("reports met when resolved before the deadline", () => {
    const c = commitment({
      openedAt: NOW - 90 * MINUTE,
      targetMinutes: 60,
      resolvedAt: NOW - 40 * MINUTE,
    });
    const evaluation = evaluateSla(c, NOW);
    expect(evaluation.status).toBe("met");
  });

  it("reports breached when resolved after the deadline", () => {
    const c = commitment({
      openedAt: NOW - 120 * MINUTE,
      targetMinutes: 60,
      resolvedAt: NOW - 30 * MINUTE,
    });
    const evaluation = evaluateSla(c, NOW);
    expect(evaluation.status).toBe("breached");
  });

  it("treats a zero-minute target as fully consumed", () => {
    const c = commitment({ openedAt: NOW, targetMinutes: 0 });
    const evaluation = evaluateSla(c, NOW);
    expect(evaluation.percentUsed).toBe(1);
    expect(evaluation.status).toBe("breaching");
  });
});

describe("summarize", () => {
  it("counts evaluations by status", () => {
    const evaluations: SlaEvaluation[] = [
      { status: "on_track", elapsedMs: 0, remainingMs: 1, deadline: 0, percentUsed: 0.1 },
      { status: "on_track", elapsedMs: 0, remainingMs: 1, deadline: 0, percentUsed: 0.2 },
      { status: "at_risk", elapsedMs: 0, remainingMs: 1, deadline: 0, percentUsed: 0.8 },
      { status: "breaching", elapsedMs: 0, remainingMs: -1, deadline: 0, percentUsed: 1.2 },
      { status: "met", elapsedMs: 0, remainingMs: 1, deadline: 0, percentUsed: 0.5 },
      { status: "breached", elapsedMs: 0, remainingMs: -1, deadline: 0, percentUsed: 1.5 },
    ];
    const counts = summarize(evaluations);
    expect(counts).toEqual({
      on_track: 2,
      at_risk: 1,
      breaching: 1,
      met: 1,
      breached: 1,
    });
  });

  it("returns all-zero counts for an empty list", () => {
    expect(summarize([])).toEqual({
      on_track: 0,
      at_risk: 0,
      breaching: 0,
      met: 0,
      breached: 0,
    });
  });
});
