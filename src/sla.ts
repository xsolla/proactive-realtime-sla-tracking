import type {
  DashboardSnapshot,
  EvaluatedCommitment,
  Partner,
  SlaCommitment,
  SlaEvaluation,
  StatusCounts,
} from "./types.js";

/**
 * Fraction of the resolution budget that must be consumed before an open
 * commitment is flagged as "at risk" so the team can act proactively.
 */
export const AT_RISK_THRESHOLD = 0.75;

const MINUTE_MS = 60_000;

/**
 * Evaluate a single SLA commitment against the current time.
 * Pure function: given the same inputs it always returns the same result.
 */
export function evaluateSla(commitment: SlaCommitment, now: number): SlaEvaluation {
  const targetMs = commitment.targetMinutes * MINUTE_MS;
  const deadline = commitment.openedAt + targetMs;
  const measuredAt = commitment.resolvedAt ?? now;

  const elapsedMs = Math.max(0, measuredAt - commitment.openedAt);
  const remainingMs = deadline - measuredAt;
  const percentUsed = targetMs === 0 ? 1 : elapsedMs / targetMs;

  let status: SlaEvaluation["status"];
  if (commitment.resolvedAt !== null) {
    status = commitment.resolvedAt <= deadline ? "met" : "breached";
  } else if (remainingMs <= 0) {
    status = "breaching";
  } else if (percentUsed >= AT_RISK_THRESHOLD) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  return { status, elapsedMs, remainingMs, deadline, percentUsed };
}

export function emptyCounts(): StatusCounts {
  return { on_track: 0, at_risk: 0, breaching: 0, met: 0, breached: 0 };
}

/**
 * Tally a list of evaluations into per-status counts for the dashboard header.
 */
export function summarize(evaluations: SlaEvaluation[]): StatusCounts {
  const counts = emptyCounts();
  for (const evaluation of evaluations) {
    counts[evaluation.status] += 1;
  }
  return counts;
}

/**
 * Build a full dashboard snapshot from the raw commitments and partner lookup.
 */
export function buildSnapshot(
  commitments: SlaCommitment[],
  partnersById: Map<string, Partner>,
  now: number,
): DashboardSnapshot {
  const counts = emptyCounts();
  const evaluated: EvaluatedCommitment[] = [];

  for (const commitment of commitments) {
    const partner = partnersById.get(commitment.partnerId);
    if (!partner) continue;
    const evaluation = evaluateSla(commitment, now);
    counts[evaluation.status] += 1;
    evaluated.push({ ...commitment, partner, evaluation });
  }

  // Most urgent first: least remaining time, open before resolved.
  evaluated.sort((a, b) => {
    const aOpen = a.resolvedAt === null ? 0 : 1;
    const bOpen = b.resolvedAt === null ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return a.evaluation.remainingMs - b.evaluation.remainingMs;
  });

  const activeCount = evaluated.filter((c) => c.resolvedAt === null).length;

  return { now, commitments: evaluated, counts, activeCount };
}
