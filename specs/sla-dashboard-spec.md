# Proactive SLA Tracking — Dashboard and Evaluation Engine

**Status:** design agreed, not yet built
**Date:** 2026-09-21
**Epic:** GTOC-30
**Authority on measurement rules:** [SLA Metric Definitions and Measurement Rules](https://xsolla.atlassian.net/wiki/spaces/PS4/pages/25124733898)

Suggested location in repo: `specs/sla-dashboard-spec.md`

---

## 1. Purpose

Track, in real time, how production performance measures against SLAs contractually committed to partners — so that a partner heading for a breach is visible days before it happens rather than surfaced afterwards by the partner.

This spec covers four subsystems:

| # | Subsystem | Slice |
| --- | --- | --- |
| 1 | Evaluation engine | One |
| 2 | Shared feed and role shaping | One |
| 3 | Technical (engineer) view | One |
| 4 | Alerting | One |
| 5 | Contract upload and term extraction | Two |
| 6 | Business (CSM) view | Two |

Slice one is independently useful and shippable. Slice two depends on it.

---

## 2. Context and constraints

**What exists already.** A Postgres database (Supabase) with an `sla_outages` table, written by an n8n ingestion pipeline that triggers on PIR approval in Jira, attributes affected partners using a language model, and routes records through human review in Slack before writing. Idempotency key is `(pir_key, partner)`.

**What is being added.** Historical incident data from `2026-01-01`, imported from a maintained spreadsheet. No availability data exists before that date.

**What does not exist.** SLA terms. No partner has a contractual target, allowance, status, or penalty exposure held in any system. All eleven pilot partners are tracking-only at build time.

**Design system.** Not a package. The visual language has been extracted into `.cursor/rules/`, so the app owns its own theme and components and has no design-system dependency to install or import.

**Repo state at build time.** Empty apart from `README.md`, this spec at `specs/sla-dashboard-spec.md`, and `.cursor/rules/`. Everything else is created by the prompts below.

**Data boundary.** The application reads two things: the `sla_outages` table, and contract terms. It makes no call to Jira, no service-catalogue lookup, and no request to any other system. A PIR key renders as a constructed URL, never a fetch.

**Constraint that shapes everything:** the engine's output is a function of terms that do not yet exist. The system must be fully built, testable and useful without them, and must gain scoring behaviour when they arrive without a rewrite.

---

## 3. Architecture decisions

### AD-1 — Next.js App Router, TypeScript, single deployable

Next.js avoids standing up a second service to reach Postgres, and server components make server-side permission enforcement the default path rather than something to remember. A single app at repo root — no workspace, no packages.

### AD-2 — Compute on read; persist only alert state

Evaluation runs on every request rather than being materialised on a schedule.

Rationale: `sla_outages` rows are mutable by design — upserted by key, and correctable by a human reviewer after the fact. Snapshots of mutable source data go stale silently. At eleven partners the recomputation cost is negligible.

The only persisted state is `sla_alert_state`, holding what alerting needs for deduplication.

Rejected: materialised evaluation snapshots (staleness, re-evaluation orchestration on every correction). Accepted cost: no point-in-time record of what the system believed on a past date. Mitigation if needed later is an append-only log written by the alert job, additive and not touching the read path.

### AD-3 — The engine is pure

`src/engine/` imports nothing from React, Next, the database client, or the rest of the app. It receives plain objects and returns plain objects.

This is what makes the backtest possible, the tests deterministic, and the guarantee that dashboards and alerts run identical maths structural rather than conventional.

Enforced mechanically via ESLint `no-restricted-imports` scoped to `src/engine/**`, failing the build rather than relying on discipline.

### AD-4 — `asOf` is always a parameter

`evaluate()` never calls `new Date()` internally. Every time-dependent value derives from an explicit `asOf` argument.

This is the single most load-bearing detail in the design. Without it, historical replay requires a parallel code path and every test becomes clock-dependent.

### AD-5 — No authentication in v1, but role shaping is server-side from day one

`getViewer()` returns a role from an environment variable today and reads a session later — one file changes.

Payload shaping happens on the server in two serialisers, not by conditional rendering in the client. The business payload never contains ticket keys, so they cannot leak through a missed conditional.

### AD-6 — No provisional data reaches any screen; terms arrive by committed file

No invented or provisional SLA target exists anywhere in the running system. `EmptyTermsProvider` returns no scopes until real terms exist.

Fixture terms exist for engine tests only. There is no development mode that renders a scored dashboard from fabricated numbers — the scored UI is built when the first real contract lands, against that contract.

First real terms arrive as a hand-authored file committed to the repo and read by `StaticTermsProvider`. Human entry plus pull-request review satisfies the confirmation gate in §12.2 without a bespoke review UI. Contract upload and model extraction (slice two) become a convenience for onboarding at scale, not a prerequisite for scoring.

### AD-7 — Alerting fires on transition only; the app sends

Status transitions trigger alerts; steady state writes and sends nothing. This delivers "one alert per situation" without separate rate-limiting logic.

The app posts to Slack itself rather than returning alerts for n8n to deliver. Reason: the state write and the send must succeed together. If delivery is external, state must be written before delivery is known to have succeeded — producing a row claiming an alert was sent to a person who was never told, permanently, because transition-based alerting will not retry.

n8n is a scheduler only. It holds no SLA logic and touches no SLA data. Any scheduler substitutes without design change.

---

## 4. Repo layout and module boundaries

Single Next.js application at repo root.

```
/
├── README.md
├── specs/sla-dashboard-spec.md
├── .cursor/rules/
│   ├── project.mdc          alwaysApply, short
│   ├── design.mdc           globs: src/**/*.tsx  (existing — visual language)
│   └── engine-purity.mdc    globs: src/engine/**
├── src/
│   ├── engine/    types, evaluate, status, penalty, intervals, constants
│   ├── data/      drizzle schema, outages, alert-state, health
│   ├── registry/  canonical partners and services with aliases
│   ├── terms/     provider interface, empty impl, fixture impl
│   ├── feed/      viewer, composition, business/technical serialisers
│   ├── alerts/    transition detection, message builders, slack client
│   ├── ui/        themed primitives (table, badge, card, bar)
│   └── app/       routes and pages
├── scripts/backtest.ts
└── tests/
```

**Dependency direction points inward.** `engine/` depends on nothing. `feed/` is the only module that composes data, registry, terms and engine. Routes call `feed/` and nothing beneath it. `alerts/` calls `feed/` and `data/`, never the engine directly.

---

## 5. Data layer

### 5.0 Actual `sla_outages` schema (observed 2026-09-22)

Confirmed from live rows, not assumed. The dashboard mirrors this read-only.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | int | surrogate key |
| `pir_key` | text | e.g. `GTO-543`; part of the pipeline's idempotency key |
| `partner` | text | resolved partner display name, human-approved; a display convenience that can drift |
| `partner_id` | **text** | **already present.** The external *merchant id* (e.g. `"506855"`), not a FK. Authoritative partner identity per the attribution step. String, so parse at the edge |
| `incident_started` | timestamptz | UTC |
| `affected_service` | text | free text, needs canonical resolution |
| `outage_minutes` | numeric | **returns as a string** from node-postgres |
| `severity` | text | free text, e.g. `L1 — Critical`; needs canonical resolution |
| `reviewed_by` | text | reviewer identity — engineer/audit detail |
| `decision_type` | text | e.g. `ai_approved` — human-review provenance |
| `reason` | text | reviewer note; usually empty. **Not mapped** |
| `reviewed_at` | timestamptz | |
| `pir_url` | text | constructed Jira link |
| `ai_reasoning` | text | batch-level attribution narrative across all partners, including which partners had **no** matches. **Not mapped** |

**Two fields are deliberately not mapped.** `ai_reasoning` and `reason` are pipeline audit fields. `ai_reasoning` is a batch-level narrative describing an entire attribution run across all partners, not a per-row explanation, and carries merchant IDs and internal project names. Neither has per-row evaluation value. Both remain in the table as the contemporaneous attribution audit record — valuable in a future penalty dispute — but are read by nobody in this application. Stored, not wired.

**Not to be confused with the engine's `StatusReason`.** That is computed by the engine, explains why a scope holds its status, and is unrelated to these ingestion fields. See §7.6.

**Fields with no per-row confidence signal.** Attribution has already been resolved to a `partner` string upstream. There is no per-row match-method or confidence column, so the technical view shows no attribution-confidence indicator — there is no data behind it. `decision_type` (`ai_approved` vs. a human correction) is the available provenance signal and is shown instead.

**Absent columns to note.** No `source` discriminator yet (see §5.2). No `incident_resolved` — duration is `outage_minutes` alone, as intended.

**The partners-with-zero-rows health check is derived, not parsed.** `ai_reasoning` names the partners that had no matches in a run, but the health panel must compute "registry partners with zero attributed rows this period" structurally from the resolved rows, never by reading names out of the `ai_reasoning` prose. The prose format is model-controlled and may change; the health signal must not depend on it.

### 5.1 Ownership

`sla_outages` is owned by the n8n pipeline. The dashboard declares a Drizzle table definition mirroring the existing schema for reading only, and generates no migrations against it.

The application should connect using a Postgres role with `SELECT` on `sla_outages` and write access only to its own tables. The boundary is then enforced by the database rather than by convention.

### 5.2 Schema additions owned by the dashboard

```sql
sla_alert_state (
  partner_slug    text not null,          -- registry slug, e.g. 'second-dinner'
  scope_id        text not null,          -- NOT the sla_outages.partner_id (that's a merchant id)
  period          text not null,          -- e.g. '2026-09'
  last_status     text not null,
  last_alerted_at timestamptz,
  alert_count     int not null default 0,
  updated_at      timestamptz not null,
  primary key (partner_slug, scope_id, period)
)
```

One `sla_outages` column remains a pipeline-owned change the dashboard depends on: a `source` column (`backfill` | `pipeline`), required before backfill import so the two provenances are distinguishable.

The authoritative merchant id is already written by the pipeline as `partner_id` (text). No addition needed — the dashboard reads it as the identity key. Its column name resembles a foreign key but it is an external merchant id; the mirror should comment this to prevent a later false join assumption.

### 5.3 Four traps that must be handled explicitly

**Numeric columns return strings.** node-postgres returns `numeric` as a JavaScript string. `outage_minutes` silently concatenating instead of summing is the most likely single bug in this build. Parse once at the data-layer edge; nothing downstream sees a string. A test pins this specific behaviour.

**Nullable fields require explicit partitioning.** Rows missing `outage_minutes`, `incident_started` or `affected_service` cannot be evaluated. The data layer partitions into usable and unusable and returns both, with the unusable count surfaced. Silent filtering is prohibited: a partner appearing clean because records were dropped is precisely the failure this project exists to prevent.

**Window timezone is declared, not inherited.** UTC, held as a named constant in `engine/constants.ts`, per the measurement rules page. Never derived from host or viewer locale.

**Free-text values require canonical resolution.** Partner names, service names and severity labels all arrive as free text and will not match across sources. The registry holds each pilot partner (with its `merchantIds` list and name aliases), each SLA-relevant service, and each severity level with its variants.

Partner resolution is **`partner_id` first, name second.** `partner_id` holds the external merchant id (a string, e.g. `"506855"`) and is the authoritative match — the attribution step marks it authoritative. Parse it to an integer once at the data-layer edge and match against the registry's `merchantIds` list. The free-text `partner` name is the fallback only for rows without a `partner_id`, such as historical backfill. Where `partner` and `partner_id` disagree, `partner_id` wins. `merchantIds` is modelled as a list per partner, since a partner may span several merchant accounts.

Unresolved values go to the health output and are excluded from evaluation — never silently dropped, never creating a phantom partner.

### 5.4 Registry verification

`scripts/verify-registry.ts` is a read-only script run against the live database, separate from the test suite (which stays hermetic). It reports where the data disagrees with the const registry:

| Finding | Meaning |
| --- | --- |
| Unknown id | A `partner_id` present in data but in no registry entry. Rows the dashboard will refuse to evaluate |
| Name disagreement | One `partner_id` under two partner names, or one name under two ids. The free-text name has drifted from the authoritative id |
| Zero coverage | A registry partner with no rows. Expected for some partners today, but stated explicitly — "no rows" and "no outages" look identical and only one is good news |
| Confirmed | Ids present in both, with row counts, so the healthy case is visible rather than inferred from silence |

It exits non-zero on unknown ids or name disagreements, and **never mutates the registry**. An unrecognised id is a question for a person, not a row to auto-create — auto-adding would silently create the phantom partner the resolution rules exist to prevent.

Canonical merchant ids: Scopely 151639, Niantic 221437, Kabam 237137, Warner Brothers 169548, Bandai Namco 503608, Second Dinner 506855, Nexters 60556, Roblox 38519, Twitch 13132, miHoYo 166973, Netmarble 207429.

---

## 6. Terms provider and lifecycle

### 6.1 Interface

```ts
interface SlaTermsProvider {
  listScopes(partner: PartnerId, asOf: Date): Promise<SlaScope[]>
}
```

An empty array means tracking-only. That is the entire mechanism by which the system operates without terms.

### 6.2 Scope model

The unit of evaluation is `(partner, scope)`, not `(partner, service)`.

```ts
type SlaScope =
  | { kind: 'service'; scopeId: string; service: ServiceId; terms: SlaTerms }
  | { kind: 'catch_all'; scopeId: string; includesScopedServices: boolean; terms: SlaTerms }
```

`includesScopedServices` is read from contract language, never defaulted or inferred:

- `true` — an outage in a specifically scoped service also consumes the catch-all allowance
- `false` — the catch-all covers only services no specific scope names

Under `true`, one incident can breach two scopes and generate two credits, which makes the per-contract aggregate cap load-bearing rather than theoretical.

### 6.3 Terms type

```ts
interface SlaTerms {
  target: number                 // 0.999
  window: 'calendar_month'
  timezone: string               // 'UTC' default, declared explicitly
  effectiveFrom: Date            // contract date, never upload date
  effectiveTo: Date | null
  exclusions: ExclusionClass[]
  penaltyTiers: PenaltyTier[]
  perScopeCap: number | null
  contractAggregateCap: number | null
  minimumCountableOutageMinutes: number | null
  sourceClause: string           // clause reference for every figure
  monthlyFee: Money | null       // absent means percentage-only reporting
}
```

`sourceClause` exists from the start because GTOC-41 requires every figure to trace to contract language and retrofitting provenance is painful.

### 6.4 Lifecycle

| State | Engine behaviour |
| --- | --- |
| `tracking_only` | Downtime recorded and reported. No target, status or exposure. |
| `terms_pending_review` | Identical to `tracking_only`. Unconfirmed terms are invisible to the engine. |
| `contract_bound` | Full evaluation. |

Only `contract_bound` scopes are returned by `listScopes`.

### 6.5 Implementations

- `EmptyTermsProvider` — returns `[]` unconditionally. Production, until the first contract is entered.
- `StaticTermsProvider` — reads `src/terms/contracts/` , a directory of hand-authored, PR-reviewed term files. Production, from the first contract onward. Only files marked `contract_bound` are returned.
- `FixtureTermsProvider` — reads from `tests/fixtures/`; throws on import when `NODE_ENV === 'production'`. Engine tests only. Never wired to a route or a page.
- `DbTermsProvider` — reads confirmed terms written by the extraction flow. Slice two, optional.

Swapping provider is one line of composition in `feed/`. Nothing else changes.

---

## 7. Evaluation engine

### 7.1 Signature

```ts
function evaluate(input: {
  outages: UsableOutage[]
  scopes: PartnerScopes[]
  window: Window
  asOf: Date
}): Evaluation[]
```

No clock access, no I/O, no framework imports.

### 7.2 Return type

```ts
type Evaluation =
  | { kind: 'tracking_only'
      partner: PartnerId
      service: ServiceId
      usedMinutes: number
      incidentCount: number
      comparison: BaselineComparison    // vs this partner's own recent months
      outages: OutageRef[] }
  | { kind: 'scored'
      partner: PartnerId
      scopeId: string
      target: number
      allowedMinutes: number
      usedMinutes: number
      remainingMinutes: number
      burnRate: number
      status: 'meeting' | 'at_risk' | 'breaching'
      projectedExhaustion: Date | null
      penalty: { incurred: PenaltyFigure; projected: PenaltyFigure }
      reason: StatusReason
      outages: OutageRef[] }
```

The discriminated union is deliberate. A tracking-only result has no `status` field — not null, not `"N/A"`. The UI cannot render a fabricated status because there is nothing to bind to, and TypeScript forces both cases to be handled.

Tracking-only groups by observed service; scored groups by contracted scope.

### 7.3 Interval handling

Downtime is computed over merged non-overlapping intervals **within a scope**. Two overlapping incidents affecting one scope merge to a single interval. The same incident counted in two scopes is two commitments being consumed, not double-charging.

An outage occupies `[incident_started, incident_started + outage_minutes]`. `outage_minutes` is wall-clock elapsed time and is always greater than zero; every record in the table is a real outage. These two fields are the sole basis for the timeline, for merging, and for every trend visualisation. No other timestamp is consulted.

**Window boundaries.** An outage crossing a boundary is apportioned proportionally by UTC clock time. An outage beginning 23:40 on the last day lasting 50 minutes contributes 20 minutes to the closing window and 30 to the opening one.

### 7.4 Status rules

```
breaching  = used >= allowed

at_risk    = (elapsedFraction >= MIN_ELAPSED
              AND consumedFraction >= MIN_CONSUMPTION
              AND projectedTotal > allowed)
             OR consumedFraction >= HIGH_CONSUMPTION

meeting    = neither
```

Both floors are required on the trend rule. Elapsed time alone is insufficient — a 90-second incident on day seven clears a time floor and projects to a breach on burn rate alone.

The level trigger exists because projection stops being informative late in a window. Breaching overrides both floors.

```ts
// engine/constants.ts
// PROVISIONAL — engineering estimates, not agreed policy.
// Calibrate against historical replay (GTOC-42) before enabling alerts.
export const MIN_ELAPSED = 0.2
export const MIN_CONSUMPTION = 0.1
export const HIGH_CONSUMPTION = 0.75
export const WINDOW_TIMEZONE = 'UTC'
```

### 7.5 Penalty

Two figures, never summed into one headline:

- **incurred** — from minutes actually consumed
- **projected** — from where current burn rate lands at window close

Both derive from matching downtime against the tier table and taking the worst tier crossed, then applying per-scope and contract-aggregate caps. Percentages always; currency only where `monthlyFee` exists.

CSM alerts quote projected; Legal cares about incurred. Conflating them produces either false alarm or understated breach.

### 7.6 Reason

Every scored result carries a structured `StatusReason` — which rule fired and the inputs that produced it, as data rather than prose. Required by GTOC-41 for explainability, rendered into sentences by the UI, and aggregated by rule in the backtest to calibrate the constants.

---

## 8. Feed and role shaping

### 8.1 Composition

```ts
function getSlaFeed(input: {
  asOf: Date
  window: Window
  viewer: Viewer
}): Promise<SlaFeed>
```

Loads outages, resolves identities, fetches scopes, calls `evaluate()`, shapes by role. The dashboard calls it with the current user; the alert job calls it with a system viewer. That shared call is the mechanism behind GTOC-43's requirement that the two views cannot disagree.

### 8.2 Serialisers

`toTechnicalView` — retains PIR keys, per-outage rows, `partner_id` (merchant id), canonical severity, review provenance (`decision_type`, `reviewed_by`), `source` provenance once present, and the raw `StatusReason`. No attribution-confidence field: the data carries none.

`toBusinessView` — status, consumed budget, projected exhaustion, credit percentage, plain-language sentence rendered from `StatusReason`. Contains no ticket key, no partner_id/merchant id, no reviewer identity, no internal severity label — nothing engineer- or audit-side.

### 8.3 Routes

| Route | Purpose |
| --- | --- |
| `GET /api/sla/feed` | Dashboard data |
| `GET /api/sla/health` | Unusable rows, unresolved names, missing fields (GTOC-45) |
| `POST /api/internal/alerts/run` | Scheduled alert evaluation |

The internal route triggers writes and sends messages. It requires a shared-secret header checked in the route itself, not VPN placement alone.

### 8.4 Caching — mandatory

**Every route and server component in this app sets `export const dynamic = 'force-dynamic'` and `no-store`.**

Next.js caches aggressively by default. A dashboard silently serving a fifteen-minute-old evaluation destroys the premise of compute-on-read, and fails invisibly by showing plausible stale numbers rather than an error. This belongs in `project.mdc` as a standing rule.

### 8.5 Payload envelope

The feed carries its own `asOf` and the health summary, so the UI can always state which moment it is showing and flag that records were unusable — rather than presenting a confident figure with no indication anything was dropped.

---

## 9. Technical view

### 9.1 What it shows today

Every partner is tracking-only, so there is no status, budget bar or penalty. The empty space must not be filled with a heuristic health score or a grey "OK" badge. The discriminated union prevents this structurally.

A tracking-only row shows: minutes this window, incident count, affected service, and comparison against that partner's own recent months. The comparison is descriptive — *above this partner's six-month median* — never evaluative.

This is the first place anyone can see partner-attributed downtime across all pilot partners in one view. It earns its keep before a single SLA term exists.

### 9.2 Structure

- **Header** — window selector, `asOf` timestamp, data-health chip
- **Main** — table grouped by partner, one row per scope
- **Expanded row** — contributing outages: PIR key linking to Jira, UTC start, minutes, service, canonical severity, `decision_type` (e.g. ai_approved vs. human correction), reviewer, and `source` provenance (`backfill` | `pipeline`) once that column exists
- **Backtest control** — per partner, runs historical replay once terms bind (see §11)

When terms land, scored rows gain a budget bar and status badge in the same table. No second screen.

### 9.3 Three failure modes the UI must get right

**Zero and error must never look alike.** A partner rendering `0` because a query failed looks like flawless uptime. Errors render as an explicit error state on affected rows.

**The health panel is first-class, not a footer.** Dropped rows, unresolved partner names, unmatched service names — visible on the main screen. Hiding the count behind a tab reintroduces the failure the data layer was designed to prevent.

**Closed windows show as settled, not final.** A late PIR can still move them.

### 9.4 Theming

The visual language lives in `.cursor/rules/design.mdc`. That file is authoritative; where it and this spec disagree, it wins.

The app owns its own theme. Design tokens are defined once as CSS custom properties and consumed through Tailwind config. Components live in `src/ui/` and are built against those tokens.

**No literal colour, spacing or radius value appears in a component.** Every value resolves through a token. This is the rule most likely to erode over a long build, and the one that makes the difference between a screen that looks like the product and one that looks close.

**Semantic status colours.** At-risk and breaching need warning and danger tokens. These are defined in the theme alongside the rest, in both light and dark sets, before any status badge is built — not improvised at the point of use.

**Status never rides on colour alone** — badges carry text labels, for accessibility and because these screenshots end up in decks in greyscale.

---

## 10. Alerting

### 10.1 Flow

`POST /api/internal/alerts/run` →
`getSlaFeed({ asOf: now })` →
for each scored scope, compare status against `sla_alert_state` →
on upward transition only: build message, post to Slack, then write state.

Same status as last run: nothing written, nothing sent. Recovery downgrades stored status silently without an all-clear message.

### 10.2 Write ordering

State is written **after** Slack returns success. A failed send therefore retries naturally on the next run rather than leaving a row claiming someone was warned who was not.

### 10.3 Concurrency

A slow run overlapping the next one would have both observe the same stale status and both send. Prevented by compare-and-swap: `UPDATE sla_alert_state SET ... WHERE last_status = <value read>`. The second writer loses and stays silent.

### 10.4 Recipients and content

- CSM — plain language, credit percentage at stake, projected figure
- Engineer — PIR keys, scope detail, raw inputs
- Breach — Legal and CSM together

Both built from the same evaluation by separate message builders. No alerts during excluded maintenance.

### 10.5 Tracking-only partners

The lighter "unusually bad month" heads-up from GTOC-46, computed against that partner's own prior-month median. Worded with no SLA vocabulary whatsoever, so it cannot be screenshotted as a commitment.

### 10.6 Scheduling

An n8n workflow on a timer makes one authenticated POST. It contains no SLA logic, no branching, and touches no SLA data. Separate from the ingestion workflow, sharing only the platform.

---

## 11. Backtest (GTOC-42)

Same `evaluate()`, `asOf` stepped across historical dates.

**Output** is not pass/fail. It is a count of how often each rule fired, per partner, per month — the input to calibrating `MIN_ELAPSED`, `MIN_CONSUMPTION` and `HIGH_CONSUMPTION` into values producing an alert volume a team will read.

**Structural safety.** The backtest imports the engine directly and has no access to `alerts/` or any Slack client. It is incapable of sending a real alert, rather than protected by a dry-run flag someone forgets to set.

**Bounds.** Data begins `2026-01-01`. Describe the range as "as far back as data exists" — a true twelve months is available from January 2027.

**Effective dates are respected.** Binding a contract today must not manufacture retroactive exposure for months it did not cover.

**UI control.** The per-partner backtest button runs exactly this for one partner once terms bind, rendering historical status into the dashboard. Declining it starts tracking from that moment forward.

---

## 12. Contract upload and extraction (slice two)

### 12.1 Flow

Upload contract against a partner → extraction produces draft terms with a clause reference per field → scope enters `terms_pending_review` → a person confirms each field side-by-side against the document → on confirmation, scope becomes `contract_bound` and evaluation begins.

The UI shows processing state during extraction.

### 12.2 Non-negotiable: human confirmation

A model extraction is a draft, never an authority. A target misread as 99.9% instead of 99.95% doubles the monthly allowance and every downstream figure with it, in the direction favouring Xsolla, and surfaces in a partner dispute.

This mirrors the human-review gate already applied to incident attribution in the ingestion pipeline, and exists for the same reason.

Unconfirmed terms are not returned by `listScopes`, so nothing half-verified can reach a status badge.

### 12.3 Open governance question

Signed partner contracts are commercially sensitive documents. Sending them to an external API is a question for whoever owns vendor data handling at Xsolla, and it is much cheaper to ask now than after it is built. This needs an owner before implementation begins.

---

## 13. Testing

**The engine carries nearly all of it** — pure unit tests with fixture terms, no database, no mocking.

Golden cases to write before implementation:

| Case | Asserts |
| --- | --- |
| 23:40 on the final day, 50 minutes | 20 minutes to closing window, 30 to opening |
| Two overlapping PIRs, same scope | Merged, counted once |
| Payments outage, `includesScopedServices: true` | Burns both allowances |
| Payments outage, `includesScopedServices: false` | Burns Payments only |
| Allowance exhausted on day two | Breaching, both floors overridden |
| 90-second outage, day seven | Meeting, not at risk — consumption floor not met |
| 80% consumed, day 28 | At risk via level trigger regardless of burn rate |
| Zero allowance scope | Handled without division error |
| Terms effective from March, replay from January | No January or February exposure |

Data layer: one test pinning that `outage_minutes` sums numerically rather than concatenating.

Integration: one test asserting business payloads contain no PIR keys.

No UI snapshot tests.

---

## 14. Open questions

| # | Question | Blocks | Owner |
| --- | --- | --- | --- |
| 1 | Vendor data handling for contract documents sent to an external API | Slice two implementation | Needs an owner |
| 2 | Which Slack channels receive CSM, engineer and Legal alerts | Alerting | Partner Success |
| 3 | Who confirms extracted terms — CSM, Legal, or both | Slice two | Partner Success / Legal |
| 4 | Deployment target and how n8n reaches the internal endpoint | Alerting | Engineering |
| 5 | `source` discriminator column (blocks backfill import). `partner_id`/merchant id is already written by the pipeline | Data layer, backfill | Engineering / n8n owner |

**Closed 2026-09-21.** `outage_minutes` is wall-clock elapsed time, always positive, and together with `incident_started` is the sole basis for the timeline. Interval merging is valid as specified.

---

## 15. Build sequence

| Prompt | Scope | Depends on |
| --- | --- | --- |
| 1 | App scaffold, `project.mdc`, `engine-purity.mdc`, ESLint purity zone, theme tokens | — |
| 2 | Registry, data layer, health partitioning | 1 |
| 3 | Terms provider, types, lifecycle, empty / static / fixture implementations | 1 |
| 4 | Engine: intervals, status, penalty, reason — with the golden tests | 3 |
| 5 | Feed, serialisers, viewer, routes | 2, 4 |
| 6 | Technical view — tracking-only rendering | 5 |
| 7 | Alert state, transition detection, message builders, internal route | 5 |
| 8 | Backtest script | 4 |
| 9 | n8n scheduling workflow | 7 |
| 10 | First contract entered as a term file, `StaticTermsProvider` switched on | 3 |
| 11 | Scored UI: budget bars, status badges, penalty exposure | 6, 10 |
| 12 | Calibrate engine constants against backtest output | 8, 10 |
| 13+ | Slice two: upload, extraction, review UI, business view | 11 |

Prompt 4 is the one to review most carefully — everything downstream inherits its correctness. Prompts 10 to 12 are gated on real contracts arriving, not on engineering time.
