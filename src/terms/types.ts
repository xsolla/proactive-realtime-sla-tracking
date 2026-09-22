import type { PartnerId, ServiceId } from "@/registry";

/**
 * Section 6.4. `tracking_only` is not stored on a file: it is what `listScopes`
 * means when it returns []. The other two states are written on a terms file.
 * Only `contract_bound` is visible to the engine.
 */
export const TERMS_LIFECYCLE_STATES = [
  "tracking_only",
  "terms_pending_review",
  "contract_bound",
] as const;

export type TermsLifecycle = (typeof TERMS_LIFECYCLE_STATES)[number];

/**
 * Carve-outs a contract can name. Extend this union in the pull request that
 * enters a contract using a class that is not listed. Do not map an unlisted
 * class onto a nearby one.
 */
export const EXCLUSION_CLASSES = [
  "planned_maintenance",
  "partner_caused",
  "force_majeure",
] as const;

export type ExclusionClass = (typeof EXCLUSION_CLASSES)[number];

/**
 * One row of the contract penalty table, copied from the clause.
 * `belowAvailability` is the contract's own uptime figure (0.99 means below 99%).
 * The engine decides which tier was crossed. Do not precompute that here.
 */
export interface PenaltyTier {
  belowAvailability: number;
  /** Credit as a fraction of fees. 0.1 is a 10% credit. */
  creditFraction: number;
}

/** Fee figure as written in the contract. Absent on `SlaTerms` means percentage-only reporting. */
export interface Money {
  /** Major units, as written. 10000 is 10,000 of `currency`, not cents. */
  amount: number;
  /** ISO 4217 code, as written. */
  currency: string;
}

export interface SlaTerms {
  /** Uptime target as a fraction. 0.999 is 99.9%. */
  target: number;
  window: "calendar_month";
  /** Measurement timezone. Write it even when the value is UTC. */
  timezone: string;
  /** Instant the contract makes these terms effective. Never the date the file was added. */
  effectiveFrom: Date;
  /** Last instant these terms apply, inclusive. Null when the contract states no end. */
  effectiveTo: Date | null;
  exclusions: ExclusionClass[];
  penaltyTiers: PenaltyTier[];
  /** Maximum credit fraction for this scope. Null when the contract states no per-scope cap. */
  perScopeCap: number | null;
  /** Maximum credit fraction across scopes. Null when the contract states no aggregate cap. */
  contractAggregateCap: number | null;
  /** Null when the contract states no minimum duration. */
  minimumCountableOutageMinutes: number | null;
  /** Clause reference for the figures in this record. */
  sourceClause: string;
  /** Null means the contract states no fee and reporting stays in percentages. */
  monthlyFee: Money | null;
}

export type SlaScope =
  | {
      kind: "service";
      scopeId: string;
      service: ServiceId;
      terms: SlaTerms;
    }
  | {
      kind: "catch_all";
      scopeId: string;
      /**
       * Required. Read from the contract. No default.
       * true — an outage in a specifically scoped service also consumes this allowance.
       * false — this allowance covers only services no specific scope names.
       */
      includesScopedServices: boolean;
      terms: SlaTerms;
    };

type TermsFileBase = {
  partner: PartnerId;
  scopes: readonly SlaScope[];
};

/**
 * A hand-authored file. `example: true` is the format specimen only, and it
 * cannot be `contract_bound`. A real contract omits `example`.
 */
export type HandAuthoredTermsFile =
  | (TermsFileBase & {
      example: true;
      lifecycle: "terms_pending_review";
    })
  | (TermsFileBase & {
      example?: false;
      lifecycle: "terms_pending_review" | "contract_bound";
    });
