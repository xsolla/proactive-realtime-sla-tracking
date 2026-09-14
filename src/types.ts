export type PartnerTier = "platinum" | "gold" | "silver";

export type Priority = "P1" | "P2" | "P3";

/**
 * Live status of an SLA commitment.
 * - on_track:  comfortably within the response budget
 * - at_risk:   most of the budget consumed; proactive attention needed
 * - breaching: budget exhausted while still open (actively missing SLA)
 * - met:       resolved within the budget
 * - breached:  resolved after the budget was exhausted
 */
export type SlaStatus = "on_track" | "at_risk" | "breaching" | "met" | "breached";

export interface Partner {
  id: string;
  name: string;
  tier: PartnerTier;
}

export interface SlaCommitment {
  id: string;
  partnerId: string;
  subject: string;
  priority: Priority;
  /** Epoch milliseconds when the commitment (ticket) was opened. */
  openedAt: number;
  /** Resolution budget in minutes. */
  targetMinutes: number;
  /** Epoch milliseconds when resolved, or null while still open. */
  resolvedAt: number | null;
}

export interface SlaEvaluation {
  status: SlaStatus;
  elapsedMs: number;
  /** Time left until the deadline. Negative once the budget is exhausted. */
  remainingMs: number;
  deadline: number;
  /** Fraction of the budget consumed (0..1+, can exceed 1 when breaching). */
  percentUsed: number;
}

export interface EvaluatedCommitment extends SlaCommitment {
  partner: Partner;
  evaluation: SlaEvaluation;
}

export interface StatusCounts {
  on_track: number;
  at_risk: number;
  breaching: number;
  met: number;
  breached: number;
}

export interface DashboardSnapshot {
  now: number;
  commitments: EvaluatedCommitment[];
  counts: StatusCounts;
  /** Active commitments only (not yet resolved). */
  activeCount: number;
}
