# Hand-authored SLA terms

One TypeScript file per partner. `StaticTermsProvider` returns a scope only when that file's `lifecycle` is `contract_bound` and `asOf` falls inside the scope's effective window. Any other lifecycle is invisible to the engine. An empty result is tracking-only.

Real contracts are typed into a new file and reviewed field-by-field in a pull request against the signed document. That review is the confirmation gate. This directory does not infer, default, or round a figure.

`example.not-a-contract.ts` is a format specimen. Its figures are invented. It is `example: true` and `terms_pending_review`. Do not copy a number out of it, and do not flip it to `contract_bound`.

## Add a contract

1. Add `src/terms/contracts/<partner-id>.ts` exporting one `HandAuthoredTermsFile`.
2. Register that export in `index.ts` in the same pull request. A file that is not registered is not read.
3. Set `lifecycle` to `terms_pending_review` until the review is done, then to `contract_bound`. Leave `example` unset.
4. In the pull request, quote the contract sentence next to each figure.

## File shape

```ts
import type { HandAuthoredTermsFile } from "../types";

export const PARTNER_TERMS = {
  partner: "scopely",
  lifecycle: "contract_bound",
  scopes: [
    {
      kind: "service",
      scopeId: "scopely-payments",
      service: "payments",
      terms: {
        target: 0.999,
        window: "calendar_month",
        timezone: "UTC",
        effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
        effectiveTo: null,
        exclusions: ["planned_maintenance"],
        penaltyTiers: [{ belowAvailability: 0.999, creditFraction: 0.1 }],
        perScopeCap: 0.5,
        contractAggregateCap: 1,
        minimumCountableOutageMinutes: null,
        sourceClause: "Schedule A, section 4.2",
        monthlyFee: null,
      },
    },
    {
      kind: "catch_all",
      scopeId: "scopely-other-services",
      includesScopedServices: false,
      terms: {
        /* same fields, from this scope's own clause */
      },
    },
  ],
} satisfies HandAuthoredTermsFile;
```

The snippet above is documentation. It is not Scopely's contract, and the numbers are not defaults.

## Fields

| Field | How to fill it |
| --- | --- |
| `lifecycle` | `terms_pending_review` until the pull request confirms every field. `contract_bound` after that. `tracking_only` is not a file state; it is the empty result when no bound scope is in force. |
| `kind` | `service` for a named service. `catch_all` for the remainder (or for a clause that covers every service). |
| `service` | Registry id, on `service` scopes only. |
| `includesScopedServices` | Catch-all only. Copy the contract. `true` when an outage in a specifically scoped service also consumes this allowance. `false` when this allowance covers only services no specific scope names. The field is required. Omitting it is an error. There is no default, and the specimen's `true` is not a hint. |
| `target` | Uptime as a fraction. `0.999` is 99.9%. |
| `window` | `calendar_month`. |
| `timezone` | The measurement timezone written in the contract. Write `UTC` when that is what it says. |
| `effectiveFrom` | The instant the contract starts these terms. Not the upload date and not the date of the pull request. |
| `effectiveTo` | The last instant the terms apply, inclusive. `null` when the contract states no end. |
| `exclusions` | Classes the contract carves out: `planned_maintenance`, `partner_caused`, `force_majeure`. An empty array means the contract states none. A class that is not in this list is added to `EXCLUSION_CLASSES` in this pull request, not folded into a similar name. |
| `penaltyTiers` | Rows from the penalty table. `belowAvailability` is the contract's uptime threshold (`0.99` means below 99%). `creditFraction` is the credit (`0.1` is 10%). Leave the "which tier applies" decision to the engine. |
| `perScopeCap` | Maximum credit fraction for this scope, or `null` when the contract states no per-scope cap. |
| `contractAggregateCap` | Maximum credit fraction across scopes of this contract, or `null` when the contract states no aggregate cap. |
| `minimumCountableOutageMinutes` | The contract's minimum, or `null` when it states none. |
| `sourceClause` | The clause each figure came from. Required on every scope. |
| `monthlyFee` | `{ amount, currency }` in major units as written, or `null` when the contract states no fee. `null` keeps reporting in percentages. |

`asOf` is compared to `effectiveFrom` and `effectiveTo` as instants. A scope is in force when `effectiveFrom <= asOf` and (`effectiveTo` is null or `asOf <= effectiveTo`).
