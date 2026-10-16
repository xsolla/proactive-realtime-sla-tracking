# Dashboard UI: shell, overview, partner pages, alerts, health

**Status:** built 2026-10-07 on branch dashboard-ui
**Date:** 2026-10-07
**Parent spec:** `specs/sla-dashboard-spec.md`. This document revises its §9 (technical view). Where the two disagree on the technical view's structure, this document wins; everything else in the parent spec stands.
**Companion:** `specs/2026-09-25-ingestion-in-app-design.md` (unchanged)
**Revised 2026-10-16:** the pages described here are rendered by the `sla-tracking` mini-app (`xsolla/mini-apps`, `apps/sla-tracking`) from the page envelopes `/api/sla/pages/*` return; see `specs/2026-10-16-mini-app-split-design.md`. The routes in §3 are the mini-app's hash routes, the loader in §5 feeds the page endpoints, and the view toggle in §4 is a browser preference sent as `?view=`. Everything about what each page shows stands; §11 and §12 are superseded as noted there.

---

## 1. Purpose

The technical view today is one long page: a data-health card followed by eleven partner tables. It is correct and nobody opens it. This design replaces it with a product-shaped dashboard: a sidebar with one entry per partner, an overview per month, a page per partner, an alert history page, and a dedicated health page. The evaluation, the feed, and every honesty rule in the parent spec are untouched. The work is presentation, one small engine addition, and one new read.

The business (CSM) view is built in the same work, on `toBusinessView`, from the same shell and components. Today a business viewer sees a stub sentence. After this design, a business viewer sees the same Overview and partner pages with the engineer-only material absent by construction: the business payload never contains it, so the components have nothing to render (parent spec AD-5, §8.2).

Reference: two mockups supplied by the owner on 2026-10-07 (a per-partner page and an organisation overview, dark theme). This design follows their layout and tone, not their invented data.

## 2. What stays fixed

- One `getSlaFeed()` call per request. Every number on a page, in the sidebar, and in the alert badge derives from that call or from a direct table read. There is no second evaluation (parent spec §8.1, project invariant).
- Every route and server component sets `dynamic = "force-dynamic"` and `no-store`.
- Zero and error never look alike. A failed load renders an error state on the affected element, never `0`, never an empty table that could pass for "clean" (parent §9.3).
- Status never rides on colour alone. Every badge and dot carries text or a mark.
- No invented figures. No currency (no partner has a monthly fee on file), no tier, no region, no stability score. A tracking-only partner has no status and the UI has nothing to bind one to.
- Settled windows are settled, not final.
- Theme tokens are the existing ones in `src/app/globals.css`. No new colours. Both light and dark render; the mockups show dark.
- Copy: short, concrete, product-like. No em dashes anywhere in rendered strings. Separators are a middle dot (`·`), a colon, or a comma.

## 3. Routes

| Route | Page | Params |
| --- | --- | --- |
| `/` | Overview | `window=YYYY-MM` |
| `/partners/[partner]` | Partner page | `window`, `backtest=1` |
| `/partners/[partner]/terms` | Contract terms (exists) | `edit=1` |
| `/alerts` | Alert history | `window`, or `window=all` |
| `/health` | Data health | none |

`window` resolves through the existing `resolveDashboardWindow`; an invalid or missing value falls back to the current UTC month. Every link the shell emits carries the current `window`. An unknown partner slug returns 404 via `notFound()`.

Revised 2026-10-16: the five routes are hash routes in the mini-app (`#/`, `#/partners/scopely?window=2026-10`, …), each backed by one page endpoint on `sla-dashboard` (`/api/sla/pages/overview`, `/api/sla/pages/partners/[partner]`, `/api/sla/pages/partners/[partner]/terms`, `/api/sla/pages/alerts`, `/api/sla/pages/health`). An unknown partner slug is a 404 from the endpoint, rendered as the mini-app's not-found state. `sla-ingestion` keeps returning 404 for every `/api/sla/*` path.

### 3.1 Roles

`resolveViewer()` decides the role per request: the `view` query parameter when it names a dashboard role (the mini-app sends its stored preference; revised 2026-10-16, no cookie), otherwise `getViewer()` and `VIEWER_ROLE`. The same routes serve both roles; the viewer picks the role with the top-bar toggle, and the page reads the feed for that role and shapes a role-specific model on the server.

| Route | technical / system | business |
| --- | --- | --- |
| `/` | Overview | Overview |
| `/partners/[partner]` | Partner page | Partner page, business variant (§9a) |
| `/partners/[partner]/terms` | view and edit | 404 |
| `/alerts` | Alert history | 404 |
| `/health` | Data health | 404 |

The business sidebar shows Overview and the partner list only. The business 404s stay: switching to the business view on `/alerts`, `/health`, or a terms page returns to the Overview. The business view shows no health count.

## 4. Shell

One `Shell` component wraps every page. Props: `nav: NavModel`, `breadcrumb`, `children`.

**Layout.** Fixed-width left sidebar (`--sidebar-width`, a new layout token in `globals.css`, `17rem`), `bg-sidebar`, 1px `border-border` on its right edge. Main column: a top bar, then content with a max width of `90rem` and generous section spacing. Below `lg` the sidebar becomes a horizontal row of links above the content. Mobile only has to work, not shine.

**Top bar.** Left: breadcrumb (`Overview`, or `Overview › Scopely`). Right, in order: `WindowSelect` (existing component, month plus "In progress" or "Settled"), the `as of` timestamp in mono, and the view toggle. The toggle is two plain links in a `nav` labelled `View`: `Engineer view` and `Business view`. The active one is marked `aria-current="page"`. Each link goes to `/view/technical` or `/view/business`, a route that sets the `sla_view` cookie and redirects back to the page the viewer was on. Anyone can switch in both directions; `VIEWER_ROLE` is only the default. The top-bar month picker reloads the current route for the chosen month; routes that are not windowed (`/health` and the terms page) hide it and pass the window through to their links.

**Sidebar.**

1. Brand block: `SLA tracking` and the caption `Partner operations`. Text only.
2. Primary nav: `Overview`, `Alerts` with a count badge, `Health` with a count badge. Badge rules are in §8 and §9. The business role sees `Overview` only.
3. `PARTNERS` heading, then one entry per pilot partner in registry order. Each entry: a status dot, the display name, and for breaching a trailing `!` mark.

Dot tone for the selected window:

| Partner state | Dot | Name |
| --- | --- | --- |
| Any term breaching | filled `danger` dot with a visible `!` in `danger` | foreground |
| Any term at risk (none breaching) | filled `warning` dot with a visible `!` in `warning` | foreground |
| All terms meeting | hollow dot, `foreground` border | foreground |
| No bound terms (tracking only) | hollow dot, `muted-foreground` border | muted-foreground |
| Feed failed | none | muted-foreground |

Active entry: `bg-secondary` with a 2px `primary` left edge. No partner filter input; eleven entries fit.

**NavModel.** Built in `src/app/dashboard/nav.ts` from the same `PartnerView[]` the page renders, plus the alert and health counts:

```ts
type NavModel = {
  windowKey: string
  partners: { id: string; name: string; href: string; tone: "breached" | "at_risk" | "meeting" | "tracking" | "unknown" }[]
  alerts: { count: number } | { status: "error" } | null   // null for business
  health: { count: number } | { status: "error" } | null   // null for business
  active: { kind: "overview" } | { kind: "alerts" } | { kind: "health" } | { kind: "partner"; id: string }
}
```

## 5. Loader

`loadDashboard()` becomes `loadWorkspace(params)` and returns everything a page needs in one object:

```ts
type Workspace =
  | { state: "ready"; frame: Frame; partners: PartnerView[]; nav: NavModel; alerts: AlertStateView; health: HealthView }
  | { state: "unavailable"; frame: Frame; message: string; nav: NavModel; partners: PartnerView[] }
  | { state: "business"; frame: Frame; partners: PartnerView[]; nav: NavModel }
```

The `business` state carries the same `PartnerView[]` shape as `ready`, built by a second builder from `BusinessRow[]` (§11). It has no alerts, health detail, terms index, or backtest. The old `business_viewer` stub state is removed.

Reads, in order: viewer (the `sla_view` cookie, then `VIEWER_ROLE`), contract terms index, feed, alert state. Health detail (`getSlaHealth`, for the unusable rows) is read only when `/health` asks for it. The feed read and the alert-state read fail independently: a failed alert read makes the badge `!` and the Alerts page an error line, and leaves everything else working. The backtest attachment stays per partner and is only loaded on the partner page.

`Frame` is the existing `{ windowKey, windowTitle, phase, months }`.

## 6. Overview (`/`)

**Heading.** `Overview`. Summary line from counts: `Monitoring 12 SLA terms across 7 partners · 4 partners tracking only.` "Terms" means scored scopes in this window.

**Tiles.**

| Tile | Figure | Treatment |
| --- | --- | --- |
| Breached | scored scopes with status `breached` | tile background tinted `danger` at low opacity and figure in `danger` when > 0 |
| At risk | scored scopes with status `at_risk` | figure in `warning` when > 0; a `?` beside the label opens the current trend and level thresholds, breach boundary, and Slack transition behaviour |
| Meeting | scored scopes with status `meeting` | plain |
| Tracking only | partners with no bound terms | muted, sub-line `No target, no status` |

**SLA Breaches/At Risk for Selected Month.** A table of every scored scope with status `at_risk` or `breached`, breached first, then consumed fraction descending.

| Column | Content |
| --- | --- |
| Partner · scope | partner name linking to `/partners/[id]`, scope title beneath in muted |
| Contractual Status | `StatusBadge` |
| Target / Actual | `99.950% / 99.760%`; actual in the status colour; caption `to date` while the window is open |
| SLA Consumed | `BudgetBar` then `351.9% consumed` in mono beneath |

Column headings and row values are centred within their columns.

Empty: a sentence, `No term is at risk or breached in this window.`, not an empty table.

**States.** Settled window: the existing settled note under the heading. Feed unavailable: tiles show `Unavailable` as the figure with the error message beneath the heading, and the attention table renders one error row in `danger`. Business role: the same page from the business model (§9a).

## 7. Partner page (`/partners/[partner]`)

**Header.** Breadcrumb `← Overview`. Partner display name, then the worst-status badge across its terms, or a `Tracking only` chip. Mono meta line: `Merchant ID 151639 · 3 terms · Contract on file`, where the last segment links to the terms page and reads `Add contract terms` or `Draft terms, not scoring` as in §6. Merchant IDs come from the registry entry; several IDs are listed comma separated. Right: the Backtest button with its existing enablement rule; its panel renders after the terms table.

**Tiles.**

| Tile | Figure | Sub-line |
| --- | --- | --- |
| Covered services | scored terms | `4 outage instances` (distinct PIR keys across terms) |
| At risk | at risk plus breaching, `/ total` | `warning` when > 0 |
| Breached | breaching count | `danger` when > 0 |
| Downtime this window | counted minutes summed across terms | `of 66.9 min allowed` |

Tracking-only partner: tiles read `No terms` for the first three and the fourth shows recorded minutes with no allowance line.

**SLA term evaluations.** One row per scored term, expandable with the existing `<details>` disclosure and script. Every row expands.

| Column | Content |
| --- | --- |
| Service | scope title; mono sub-line `76.0 / 21.6 min down` |
| Contractual Status | `StatusBadge` |
| Target / Actual | as §6 |
| SLA Consumed | as §6 |
| Incident Ticket Reference | distinct PIR keys such as `GTO-543`, comma-separated; `N/A` when the term has no incident; `Not available` when references are withheld from the business view |

Column headings and row values are centred within their columns.

Expanded content opens with the Window trend (§7.1) under a `Window trend` caption; it is not a table column. Below it, for a row with outages, today's `OutageLines`: PIR key linked to `pir_url`, start, computed end, minutes (both durations for a boundary outage), filed service, severity, merchant id, source, review line, merged groups marked, reconciliation line.

Scored partners with outages outside their scopes get a second table, `Outside contracted scopes`, with the tracking columns from below.

### 7.1 Window trend

Rendered in the expanded panel of each term and tracking row, above any outage lines. Each shows twelve bars: eleven prior calendar months then the selected month. Prior bars are `muted-foreground`; the current bar takes the status colour on a scored row and `foreground` on a tracking row. A month before data coverage renders as a gap with no bar. Each bar carries a `<title>` of `April 2026: 12.0 min`, and a three-letter month label sits under each bar. The SVG is server-rendered and stretches to the full width of the panel; it has `role="img"` and an `aria-label` summarising the series.

The trend carries no median mark or text. The comparison against recent months stays in the tracking table's `Compared with recent months` column. The data comes from the engine, §10.

**Recorded downtime (tracking only).** For a partner with no bound terms: a line `Tracking only. Minutes are recorded downtime; there is no target or status.`, then a table with columns Service, Minutes this window, Incidents, Compared with recent months. Every row expands to the Window trend (§7.1), followed by the same outage lines when it has any; the unavailable row does not expand. A partner with no terms and no recorded rows shows the sentence `No downtime recorded in this window.` instead of a table.

**States.** Feed unavailable: header stays, tiles read `Unavailable`, one error row in the table, no cards. Business role: the variant in §9a. Unknown slug: 404.

## 8. Alerts page (`/alerts`)

Reads `sla_alert_state` through a new `listAlertState(db)` in `src/data/` (the dashboard role already holds SELECT on it). The page shows what the alert job last recorded, one row per `(partner_slug, scope_id, period)`.

Note under the heading: `Transitions only. The job writes a row when a status rises and sends; recoveries are recorded without a message.`

| Column | Content |
| --- | --- |
| Partner | display name, link to the partner page for that period |
| Scope | scope title; a `tracking:<service>` id renders as `Service: Login` |
| Month | `September 2026` |
| Last status | `StatusBadge` for `at_risk` and `breached`; `Chip` for `meeting`, `heads_up` (`Heads-up`), `quiet`, and any other value verbatim |
| Last alerted | mono UTC timestamp, or `Never` |
| Alerts sent | `alert_count` |

Sort: `last_alerted_at` descending, nulls last. Filter: the window param; `window=all` lists every month. Default is the selected window.

**Badge.** Rows in the selected window whose `last_status` is `at_risk`, `breached`, or `heads_up`. These are situations Slack was told about that have not recovered. When the read fails the badge is `!` in `danger` and the page shows `Alert history unavailable.` in a `role="alert"` paragraph.

Empty state for a month: `No alerts recorded for September 2026.`

## 9. Health page (`/health`)

Not windowed; health covers the whole extract.

1. Tiles: Dropped rows (`of N rows in the extract`), Unresolved partners, Unmatched services, Partners with no rows (sub-line as today), Invalid contract terms, Failed PIRs, PIRs with unresolved values, Captured without a Slack message. A figure is `warning` when > 0, except Partners with no rows which stays plain.
2. Unusable rows table: PIR key (linked when a URL exists, otherwise text), partner, merchant id, service, started, raw minutes, reasons as named labels. This is `getSlaHealth().unusable`, which today's panel never shows.
3. Lists, as today: invalid terms with messages, unresolved partner names, unmatched service names, partners with no attributed rows, and the three ingestion lists with linked PIR keys. Separator between key and detail is `·`, not a dash.

**Badge.** Sum of dropped rows, unresolved partners, unmatched services, invalid terms, failed PIRs, unresolved PIRs, and captures without a Slack message. Partners with no rows are excluded from the sum (expected for some partners). `warning` tone when > 0. If the feed or ingestion health failed, the badge is `!` in `danger` and the page shows the error state for that source while the other sources render.

The sidebar Health badge keeps the dropped-rows count on every engineer screen. This is the compromise with parent §9.3, and §9.3 is amended to say so. The business view shows no health count.

## 9a. Business view

The business viewer gets the Overview (§6) and the partner page (§7) rendered by the same components from a model built on `toBusinessView`. What differs is only what the business payload lacks.

**Overview.** Identical to §6. Tiles and the attention table use status, consumed budget, credit percentage, and counts, all of which the business row carries.

**Partner page.**

| Element | Technical | Business |
| --- | --- | --- |
| Header meta line | `Merchant ID 151639 · 3 terms · Contract on file` (link) | `3 terms · Monthly window` |
| Backtest button | per existing rule | absent |
| Tiles | §7 | §7, same four |
| Term table | §7 columns, rows expand to the trend and outage lines | §7 columns, rows expand to the trend only; no outage lines |
| Window trend | §7.1, in the expanded panel | §7.1, in the expanded panel, from `history` on the business row |
| Incident Ticket Reference | PIR keys, or `N/A` with no incident | `Not available`; ticket identifiers remain excluded |
| Credit | incurred → projected | incurred → projected |
| Recorded downtime (tracking only) | expands to the trend and outage lines | expands to the trend only; comparison sentence as the business row renders it |

The business row's `summary` sentence is the status sentence on its cards. The technical page keeps rendering its sentence from `StatusReason` through `copy.ts`, as today.

**Disclosure scope.** The only `<details>` that must never reach a business viewer is the outage disclosure (`data-outages`). The month picker in the top bar is also a `<details>` and is shared by both roles, as is the row expander that holds only the trend (`data-disclosure` without `data-outages`).

**Nothing is hidden by a conditional.** The business `PartnerView` is built from `BusinessRow`, which has no PIR key, URL, merchant id, severity, reviewer, clause, or reason object. A component asked to render tickets receives an empty list and renders nothing; the card's tickets block is omitted when the view carries `tickets: null`. A page-level test asserts the rendered business markup contains none of the sentinel values the payload test already guards (parent §13).

## 10. Engine addition

`evaluate()` gains, with no change to any existing field:

```ts
// on scored results
windowMinutes: number     // full scored window length, prorated start respected
elapsedMinutes: number    // min(asOf, window.end) - window.start, 0 before the window opens
history: MonthHistory[]

// on tracking_only results
history: MonthHistory[]

type MonthHistory = { month: string; usedMinutes: number | null }  // "YYYY-MM"; null before data coverage
```

`history` is the eleven calendar months before the window's month, oldest first, computed with the same `attribute()` and `countDowntime()` the status uses, over the scope's services (scored) or the single service (tracking). The existing `baseline()` is rewritten to derive its median from the last six of these totals so the two cannot drift. Covered months with no outages are `0`; months before `DATA_COVERAGE_START` are `null`.

Actual uptime is a display derivation in `copy.ts`: `1 - usedMinutes / elapsedMinutes` while the window is open, `1 - usedMinutes / windowMinutes` once settled. When `elapsedMinutes` is 0 the figure renders as `100.000%`. Formatted to three decimals by `formatUptime`.

The technical serialiser passes the three fields through.

`toBusinessView` gains, on both row kinds, `partnerId` (the registry slug, needed for links; not the merchant id) and `history`; on scored rows also `windowMinutes` and `elapsedMinutes`, so the business page derives actual uptime the same way. It still carries no PIR key, URL, merchant id, severity, reviewer, clause, or `StatusReason`. `tests/feed/business-payload.test.ts` keeps guarding that.

Tests (`tests/engine/evaluate.test.ts`):

- A scope with outages in three of six prior months reports those totals, `0` for covered empty months, and `null` for months before coverage.
- A tracking row's `history` median equals its `comparison.medianMinutes`.
- `windowMinutes` on a prorated window equals the shortened length; `elapsedMinutes` is 0 before the window opens and equals `windowMinutes` after it closes.

Scored results also carry `comparison`, from the same `baseline()` as tracking rows, so the trend mark on a scored row uses the one median implementation. Business rows carry `target` and `versusMedian` for the same reason. (Decided during planning, 2026-10-07.)

## 11. Module layout

**Superseded 2026-10-16.** The `.tsx` files, `shell/`, the pages and `src/ui/` listed below moved to `xsolla/mini-apps` `apps/sla-tracking` (`src/shell`, `src/dashboard`, `src/terms`, `src/ui`, with `src/api/types.ts` as a hand copy of the envelope types). This repo keeps `src/app/dashboard/{view,overview,partner-page,alerts-view,nav,badges,model,outage-view,copy,load,pages,run-backtest}.ts` and the route handlers under `src/app/api/sla/pages/`. §11.1 stands: the view model is built on the backend and the mini-app renders it. The original layout, for the record:

```
src/app/
├── shell/            shell.tsx, sidebar.tsx, top-bar.tsx
├── dashboard/        view.ts (role-neutral view model and both builders), overview.ts, partner-page.ts,
│                     alerts-view.ts, nav.ts, badges.ts (alertsBadge, healthBadge: pure, re-exported by
│                     load.ts), load.ts, model.ts (month options, health view, backtest panel, unusable
│                     rows), outage-view.ts, copy.ts, run-backtest.ts, outage-disclosure.ts,
│                     overview-page.tsx, partner-page-view.tsx, alerts-page.tsx, health-page.tsx,
│                     attention-table.tsx, term-table.tsx, tracking-table.tsx,
│                     trend-sparkline.tsx, outage-lines.tsx, backtest-panel.tsx,
│                     window-select.tsx
├── page.tsx                      overview
├── partners/[partner]/page.tsx   partner page
├── partners/[partner]/terms/     unchanged, wrapped in Shell
├── alerts/page.tsx
└── health/page.tsx
src/data/alert-state.ts           listAlertState
src/ui/                           + tile.tsx, sparkline.tsx (generic bars), status-dot.tsx
```

`partner-table.tsx`, `scored-row.tsx`, `scope-row.tsx`, `health-panel.tsx`, and `technical-dashboard.tsx` were removed once their behaviour had moved. Boundaries are unchanged: `src/app` imports `feed`, `data` (reads only, as `load.ts` already does), `alerts` types, and `ui`; never `engine`, `registry`, or `terms` directly. Merchant IDs reach the page through a new `partnerMerchantIds(id)` export in `feed/labels.ts`.

### 11.1 One view model, two builders

Components render a role-neutral view model and never see a feed row. The engineer-only material is optional in the type and `null` in the business build:

```ts
type TermView = {
  key: string
  title: string
  status: "meeting" | "at_risk" | "breached"
  target: string; actual: string; actualCaption: string | null
  allowed: string; consumed: string; remaining: string
  usedMinutes: number; allowedMinutes: number; consumedPercent: string
  trend: TrendView
  credit: { incurred: string; projected: string }
  sentence: string
  nextTier: string | null
  windowNote: string | null
  clause: { text: string; missing: boolean } | null   // technical only
  tickets: { key: string; href: string | null }[] | null  // technical only
  outages: OutageView[] | null                        // technical only; null means not expandable
}

type TrackingView = {
  key: string; service: string; minutes: string; incidents: string
  comparison: string; trend: TrendView
  outages: OutageView[] | null
}

type PartnerView = {
  id: string; name: string
  merchantIds: string[] | null       // technical only
  terms: TermView[]; tracking: TrackingView[]
  worst: "breached" | "at_risk" | "meeting" | null   // null when tracking only
  contractTerms: "add" | "view" | "draft" | "unknown" | null   // null for business
  backtest: BacktestState | null     // null for business
}
```

`buildTechnicalPartners(rows: TechnicalRow[], ...)` and `buildBusinessPartners(rows: BusinessRow[])` both return `PartnerView[]`. `buildOverview`, `buildPartnerPage`, and `buildNav` take `PartnerView[]` and do not know the role. `Tiles`, `TermTable`, `TrendSparkline`, `AttentionTable`, and `Shell` are shared. `OutageLines`, `BacktestPanel`, and the terms link render only when their input is non-null.

## 12. Testing

**Revised 2026-10-16.** Builder tests stay here as `.test.ts` (`overview`, `partner-page`, `alerts`, `health`, `nav`, `view`, `badges`, `dashboard-copy`), plus `pages.test.ts` (envelopes, JSON round trip, committed samples under `tests/app/fixtures/pages/`), `pages-routes.test.ts`, `review-route.test.ts`, `contract-terms-route.test.ts` (through the terms page endpoint) and `business-pages.test.ts` (the sentinel values are absent from the business envelopes' JSON). The render tests moved to the mini-app (`src/**/*.test.tsx` with vitest and happy-dom, one Playwright spec per `qa.views` entry). The original split, for the record:

- `shell.test.tsx`: dot tone per partner state, active entry, badges including `!` on error, window param preserved on every href.
- `overview.test.tsx`: tile counts, attention ordering, empty sentence versus error row, no `0%` for an unentered clause, settled note.
- `partner-page.test.tsx`: tiles, term table columns, expanded outage lines with reconciliation and merged overlap counted once, tracking-only page, and error row on failure.
- `alerts.test.tsx`: sort order, `tracking:` scope label, badge count excludes `meeting` and `quiet`, error state.
- `health.test.tsx`: unusable rows table, lists with `None`, ingestion error never a zero.
- `trend.test.tsx`: seven bars, gap for a pre-coverage month, mark text per condition.
- `dashboard-copy.test.ts`: actual uptime derivation, no em dash in any exported string (a single test iterating the copy module's string exports).
- `business-page.test.tsx`: Overview and partner page rendered from a business workspace show the same tiles, table columns, trend, and cards; no row expands; no tickets or clause block; the markup contains none of the sentinel values from `tests/feed/business-payload.test.ts` (PIR key, merchant id, reviewer, severity, fixture clause); `/alerts`, `/health`, and the terms route return 404 for the business role.

`tests/app/scope-row.test.tsx` moves to `term-table.test.tsx` and keeps its disclosure behaviour test.

## 13. Parent spec amendments

Applied to `specs/sla-dashboard-spec.md` with this slice:

- §1: subsystem 5 (business view) moved from "one-and-a-half" to this slice; it ships with the technical view, on real terms only, as AD-6 already requires.
- §7.2: added `windowMinutes`, `elapsedMinutes`, `history`, and `comparison` to the scored result and `history` to the tracking result, and defined `MonthHistory`.
- §8.2: `toBusinessView` additionally carries `partnerId` (registry slug), `target`, `windowMinutes`, `elapsedMinutes`, `history`, and `versusMedian`. The exclusion list is unchanged.
- §8.3: added `GET /alerts` and `GET /health` pages (not API routes) to the route table, technical role only.
- §9.2: replaced with a pointer to this document's §4 to §9a.
- §9.3: amended "The health panel is first-class" to: the dropped-rows count is on every engineer screen through the sidebar Health badge; the detail lives on `/health`, one click away.
- AD-5 and §8.1: until SSO lands the role is a viewer preference set by the top-bar toggle through the `sla_view` cookie; the API routes and alert job keep using `getViewer()`.

## 14. Out of scope

Partner filter input, currency and contract value, contract tiers and regions, cumulative burn line within the month, light-theme tuning beyond the existing tokens, sign-in.
