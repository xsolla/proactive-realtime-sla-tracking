import type { HandAuthoredTermsFile } from "../types";

/**
 * FORMAT SPECIMEN. NOT A CONTRACT.
 * Every number below is invented so the shape can be reviewed.
 * Do not copy a figure into a real file. Do not set lifecycle to contract_bound
 * on this file. StaticTermsProvider will not return it while lifecycle stays
 * terms_pending_review, and it rejects the file if example and contract_bound
 * are set together.
 */
export const EXAMPLE_NOT_A_CONTRACT = {
  example: true,
  partner: "scopely",
  lifecycle: "terms_pending_review",
  scopes: [
    {
      kind: "service",
      scopeId: "example-payments",
      service: "payments",
      terms: {
        target: 0.999,
        window: "calendar_month",
        timezone: "UTC",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        exclusions: ["planned_maintenance"],
        penaltyTiers: [{ belowAvailability: 0.999, creditFraction: 0.1 }],
        perScopeCap: 0.5,
        contractAggregateCap: 1,
        minimumCountableOutageMinutes: 5,
        sourceClause: "EXAMPLE — not a contract clause",
        monthlyFee: { amount: 1, currency: "XXX" },
      },
    },
    {
      kind: "catch_all",
      scopeId: "example-catch-all",
      // From the contract sentence. true and false are both explicit. There is no default.
      includesScopedServices: true,
      terms: {
        target: 0.999,
        window: "calendar_month",
        timezone: "UTC",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-12-31T23:59:59.999Z"),
        exclusions: [],
        penaltyTiers: [
          { belowAvailability: 0.999, creditFraction: 0.05 },
          { belowAvailability: 0.99, creditFraction: 0.1 },
        ],
        perScopeCap: null,
        contractAggregateCap: null,
        minimumCountableOutageMinutes: null,
        sourceClause: "EXAMPLE — not a contract clause",
        monthlyFee: null,
      },
    },
  ],
} satisfies HandAuthoredTermsFile;
