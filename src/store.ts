import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { buildSnapshot } from "./sla.js";
import type {
  DashboardSnapshot,
  Partner,
  Priority,
  SlaCommitment,
} from "./types.js";

const MINUTE_MS = 60_000;

const PARTNERS: Partner[] = [
  { id: "acme", name: "Acme Corp", tier: "platinum" },
  { id: "globex", name: "Globex", tier: "gold" },
  { id: "initech", name: "Initech", tier: "gold" },
  { id: "umbrella", name: "Umbrella Co", tier: "silver" },
  { id: "hooli", name: "Hooli", tier: "platinum" },
];

const SUBJECTS = [
  "API latency spike on checkout",
  "Webhook delivery failures",
  "Dashboard not loading",
  "Payment reconciliation mismatch",
  "SSO login errors",
  "Data export stuck",
  "Rate limit exceeded unexpectedly",
  "Report generation timeout",
  "Mobile push notifications delayed",
  "Billing invoice discrepancy",
];

const PRIORITIES: Priority[] = ["P1", "P2", "P3"];

/** Resolution budget in minutes by priority. */
const TARGET_BY_PRIORITY: Record<Priority, number> = {
  P1: 30,
  P2: 120,
  P3: 480,
};

const MAX_ACTIVE = 12;

function pick<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index] as T;
}

export type NewCommitmentInput = {
  partnerId?: string;
  subject?: string;
  priority?: Priority;
  targetMinutes?: number;
  openedAt?: number;
};

/**
 * In-memory store of partners and their SLA commitments, plus a lightweight
 * realtime simulation so the dashboard stays lively without a real backend.
 */
export class SlaStore {
  readonly partners: Partner[] = PARTNERS;
  readonly commitments: SlaCommitment[] = [];

  private readonly partnersById = new Map<string, Partner>();
  private readonly emitter = new EventEmitter();

  constructor(now: number = Date.now()) {
    for (const partner of this.partners) {
      this.partnersById.set(partner.id, partner);
    }
    this.seed(now);
  }

  /**
   * Seed a healthy mix of on_track / at_risk / breaching open commitments by
   * varying how long ago each was opened relative to its budget.
   */
  private seed(now: number): void {
    // [priority, minutesAgoOpened] tuned to land in different statuses.
    const seeds: Array<[Priority, number]> = [
      ["P3", 30], // ~6% used  -> on_track
      ["P2", 15], // ~12% used -> on_track
      ["P1", 12], // 40% used  -> on_track
      ["P2", 100], // ~83% used -> at_risk
      ["P1", 25], // ~83% used -> at_risk
      ["P3", 400], // ~83% used -> at_risk
      ["P1", 45], // overdue   -> breaching
      ["P2", 150], // overdue   -> breaching
    ];

    for (const [priority, minutesAgo] of seeds) {
      const partner = pick(this.partners);
      this.commitments.push({
        id: randomUUID(),
        partnerId: partner.id,
        subject: pick(SUBJECTS),
        priority,
        openedAt: now - minutesAgo * MINUTE_MS,
        targetMinutes: TARGET_BY_PRIORITY[priority],
        resolvedAt: null,
      });
    }
  }

  private get activeCount(): number {
    return this.commitments.filter((c) => c.resolvedAt === null).length;
  }

  snapshot(now: number = Date.now()): DashboardSnapshot {
    return buildSnapshot(this.commitments, this.partnersById, now);
  }

  /** Subscribe to snapshots pushed after every mutation/tick. Returns an unsubscribe fn. */
  subscribe(listener: (snapshot: DashboardSnapshot) => void): () => void {
    this.emitter.on("snapshot", listener);
    return () => this.emitter.off("snapshot", listener);
  }

  /** Emit the current snapshot to all subscribers. */
  broadcast(now: number = Date.now()): DashboardSnapshot {
    const snapshot = this.snapshot(now);
    this.emitter.emit("snapshot", snapshot);
    return snapshot;
  }

  open(partial: NewCommitmentInput = {}, now: number = Date.now()): SlaCommitment {
    const partnerId =
      partial.partnerId && this.partnersById.has(partial.partnerId)
        ? partial.partnerId
        : pick(this.partners).id;
    const priority = partial.priority ?? pick(PRIORITIES);
    const commitment: SlaCommitment = {
      id: randomUUID(),
      partnerId,
      subject: partial.subject ?? pick(SUBJECTS),
      priority,
      openedAt: partial.openedAt ?? now,
      targetMinutes: partial.targetMinutes ?? TARGET_BY_PRIORITY[priority],
      resolvedAt: null,
    };
    this.commitments.push(commitment);
    return commitment;
  }

  resolve(id: string, now: number = Date.now()): SlaCommitment | undefined {
    const commitment = this.commitments.find((c) => c.id === id);
    if (!commitment) return undefined;
    if (commitment.resolvedAt === null) {
      commitment.resolvedAt = now;
    }
    return commitment;
  }

  /**
   * Advance the simulation one step: occasionally resolve a near-complete open
   * commitment and occasionally open a new one. Uses small probabilities and is
   * safe to call on a fixed interval.
   */
  tick(now: number = Date.now()): DashboardSnapshot {
    const snapshot = this.snapshot(now);

    // Occasionally resolve a commitment that is on_track/at_risk (agents winning).
    const resolvable = snapshot.commitments.filter(
      (c) =>
        c.resolvedAt === null &&
        (c.evaluation.status === "at_risk" || c.evaluation.status === "on_track"),
    );
    if (resolvable.length > 0 && Math.random() < 0.35) {
      // Prefer the most-progressed (first in resolvable given sort order).
      const target = resolvable[0];
      if (target) this.resolve(target.id, now);
    }

    // Occasionally a breaching item finally gets resolved (as breached).
    const breaching = snapshot.commitments.filter(
      (c) => c.resolvedAt === null && c.evaluation.status === "breaching",
    );
    if (breaching.length > 0 && Math.random() < 0.15) {
      const target = breaching[0];
      if (target) this.resolve(target.id, now);
    }

    // Occasionally open a new commitment, keeping active count bounded.
    if (this.activeCount < MAX_ACTIVE && Math.random() < 0.3) {
      this.open({}, now);
    }

    // Trim resolved history so the table doesn't grow unbounded (keep last 8).
    const resolved = this.commitments.filter((c) => c.resolvedAt !== null);
    if (resolved.length > 8) {
      const excess = resolved
        .sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0))
        .slice(0, resolved.length - 8);
      for (const stale of excess) {
        const index = this.commitments.indexOf(stale);
        if (index >= 0) this.commitments.splice(index, 1);
      }
    }

    return this.snapshot(now);
  }
}
