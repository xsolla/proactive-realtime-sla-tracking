import type { OutageHealth, OutagePartition, UnusableReason } from "@/data";
import type { BaselineComparison, PenaltyFigure, StatusReason } from "@/engine";
import type { SeverityId } from "@/registry";
import type { SlaTermsProvider } from "@/terms";
import type { ViewerRole } from "./viewer";

/**
 * Optional stand-ins for tests. Production routes omit this and read the
 * database plus the empty terms provider.
 */
export type FeedSources = {
  partition?: OutagePartition;
  terms?: SlaTermsProvider;
};

/** Null until sla_outages gains a source column. Never invented. */
export type OutageProvenance = "backfill" | "pipeline";

export type TechnicalOutage = {
  pirKey: string;
  pirUrl: string | null;
  /** External merchant id (sla_outages.partner_id). Not the registry slug. */
  partnerId: number | null;
  severity: SeverityId;
  decisionType: string | null;
  reviewedBy: string | null;
  source: OutageProvenance | null;
  service: string;
  incidentStarted: string;
  minutes: number;
};

export type TechnicalRow =
  | {
      kind: "tracking_only";
      partner: string;
      service: string;
      usedMinutes: number;
      incidentCount: number;
      comparison: BaselineComparison;
      outages: TechnicalOutage[];
    }
  | {
      kind: "scored";
      partner: string;
      scopeId: string;
      target: number;
      allowedMinutes: number;
      usedMinutes: number;
      remainingMinutes: number;
      burnRate: number;
      status: "meeting" | "at_risk" | "breaching";
      projectedExhaustion: string | null;
      penalty: { incurred: PenaltyFigure; projected: PenaltyFigure };
      reason: StatusReason;
      outages: TechnicalOutage[];
    };

export type BusinessRow =
  | {
      kind: "tracking_only";
      partner: string;
      service: string;
      usedMinutes: number;
      incidentCount: number;
      comparison: string;
    }
  | {
      kind: "scored";
      partner: string;
      scope: string;
      status: "meeting" | "at_risk" | "breaching";
      consumedBudget: {
        usedMinutes: number;
        allowedMinutes: number;
        /** Null when the allowance is zero and the ratio is undefined. */
        fraction: number | null;
      };
      projectedExhaustion: string | null;
      /** 10 is a 10% credit. Incurred and projected stay separate. */
      creditPercentage: {
        incurred: number;
        projected: number;
      };
      summary: string;
    };

export type SlaFeed = {
  asOf: string;
  health: OutageHealth;
} & (
  | { role: "business"; rows: BusinessRow[] }
  | { role: "technical" | "system"; rows: TechnicalRow[] }
);

export type UnusableRow = {
  pirKey: string;
  partner: string;
  /** External merchant id, when the text parsed. */
  partnerId: number | null;
  affectedService: string | null;
  incidentStarted: string | null;
  rawOutageMinutes: string | null;
  reasons: UnusableReason[];
};

export type SlaHealth =
  | { asOf: string; role: "business"; health: OutageHealth }
  | {
      asOf: string;
      role: Exclude<ViewerRole, "business">;
      health: OutageHealth;
      unusable: UnusableRow[];
    };
