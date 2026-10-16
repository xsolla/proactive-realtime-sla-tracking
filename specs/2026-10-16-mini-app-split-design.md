# Mini-app frontend and API-only backend: design

**Status:** approved 2026-10-16 (GTOC-88)
**Location:** `specs/2026-10-16-mini-app-split-design.md`, beside `specs/sla-dashboard-spec.md` and `specs/2026-10-07-dashboard-ui-design.md`

## Why

The dashboard had no sign-in (main spec AD-5, OQ-4). The Xsolla mini-app host at `prototype.xsolla.dev` (ATT) already provides an Okta session, a gallery, and an authenticated proxy to Cloud Run backends. Moving the UI there gives the dashboard SSO without building any of it, and leaves one owner of every number: the backend's `getSlaFeed` and `evaluate()`.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Backend shape | This repo stays a Next.js app, with **route handlers only**. One image, two Cloud Run services selected by `SERVICE_ROLE`, unchanged | Smallest change; the ingestion routes, `after()`, the proxy gate and the Dockerfile keep working as they are |
| Frontend | A Vite + React mini-app at `xsolla/mini-apps/apps/sla-tracking/`, served at `https://prototype.xsolla.dev/mini-apps/sla-tracking` | The mini-apps CI builds from that directory; it is the source of truth for the UI |
| Boundary | **Page-level JSON.** The backend builds every page's view model, nav, breadcrumb and hrefs; the frontend renders | The builders use the registry and engine constants. A raw-feed boundary would force a copy of the registry into the frontend |
| Role shaping | Server-side, as before (AD-5). The business payload never contains tickets, clauses, outages, merchant ids or reviewer names | Same guarantee as today, now as a JSON contract that tests assert on |
| View preference | A `?view=technical\|business` query parameter the frontend sends from `localStorage`; `VIEWER_ROLE` stays the default for `/api/sla/feed`, `/api/sla/health` and the alert job | Replaces the `sla_view` cookie, which cannot cross the proxy. Still a preference, not a boundary |
| Editor identity | `PUT /api/sla/contract-terms/[partner]` records `updated_by` from `X-Forwarded-User`; the form has no name field | Main spec §6.6 said SSO replaces the typed name. The proxy now delivers the Okta email |
| Backend reachability | `ingress: all`, `allow_unauthenticated: false`, invokers: the ATT proxy service account and the runtime service account | How every mini-app backend in `neuronet-automations` is reached. No load balancer, no IAP. The runtime account stays only so `sla-alert-run` and `sla-ingestion` can call `/api/internal/alerts/run` |
| Access | `mini-app-access.json`: `everyone` | Any signed-in employee, matching AD-5's "preference, not a boundary" |
| Caching | Backend: `force-dynamic` and `Cache-Control: no-store` on every route. Frontend: `fetch(..., { cache: "no-store" })` and TanStack Query with `staleTime: 0`, `gcTime: 0`, `refetchOnMount: "always"` | The invariant now has two halves; either alone would let a stale evaluation show plausible wrong numbers |
| `sla-alert-run` | Unchanged code. Its registry entry gets the real `DASHBOARD_INTERNAL_URL` and loses `deploy_hold` | The job calls the backend with an identity token; the mini-app host is not involved |

## 1. Components

```
Browser ── Okta session ──> prototype.xsolla.dev (ATT)
   │  iframe  /mini-app-bundles/sla-tracking/index.html         Vite bundle from GCS, hash routing
   │  fetch   /api/mini-app-proxy/sla-tracking/api/sla/pages/…  same origin, no-store
   ▼
ATT proxy ── OIDC token + X-Forwarded-User ──> Cloud Run sla-dashboard (this repo, route handlers only)
                                                    │  loadWorkspace → getSlaFeed → evaluate()
                                                    ▼
                                                Cloud SQL
sla-alert-run ── OIDC token + x-internal-secret ──> sla-dashboard /api/internal/alerts/run   unchanged
Jira / Slack ─────────────────────────────────────> sla-ingestion (same image, SERVICE_ROLE=ingestion)   unchanged
```

The ATT proxy strips cookies and any client-sent identity, checks the Okta session and the app's access policy, then calls the backend's `*.run.app` URL with a Google OIDC token for `att-prototype-vm@automation-experiments-456100.iam.gserviceaccount.com` and `X-Forwarded-User: <okta email>`. The backend trusts only that header for identity, never the body.

### What this repo keeps

`src/engine`, `src/data`, `src/registry`, `src/terms`, `src/feed`, `src/alerts`, `src/ingestion`, `src/slack`, the `SERVICE_ROLE` gate (`src/proxy.ts`, `src/service-role.ts`, `src/instrumentation.ts`), and under `src/app/`: `layout.tsx` (Next requires a root layout even with no pages), every `api/**` route, and `dashboard/` as a pure view-model module: `load.ts`, `view.ts`, `overview.ts`, `partner-page.ts`, `alerts-view.ts`, `nav.ts`, `badges.ts`, `model.ts`, `outage-view.ts`, `copy.ts`, `run-backtest.ts`, and the new `pages.ts`.

### What moves to `apps/sla-tracking`

The presentational React: `src/ui/*`, the shell (sidebar, top bar), the dashboard components (overview, partner page, alerts, health, tables, trend, outage lines, backtest panel, window select), the contract terms form and view, `globals.css` and the Tailwind theme additions. The mini-app renders the JSON the backend returns and holds a hand-copied `src/api/types.ts` of the envelope shapes.

The rule: **labels, hrefs and builders live with the registry.** A string that depends on data (a status label, a month title, a sentence) is built on the backend and travels in the JSON. Only static chrome (section headings, empty-state sentences, button labels) lives in the frontend.

## 2. API

Every route sets `export const dynamic = "force-dynamic"`, `export const fetchCache = "force-no-store"`, calls `noStore()`, and returns `Cache-Control: no-store` (main spec §8.4).

Query parameters: `window=YYYY-MM` (default: the current month), `view=technical|business` (anything else falls back to `VIEWER_ROLE`).

| Route | Body | 404 when |
| --- | --- | --- |
| `GET /api/sla/pages/overview` | `{ frame, nav, breadcrumb, showWindow: true, view: OverviewView }` | never |
| `GET /api/sla/pages/partners/[partner]?backtest=1` | `{ frame, nav, breadcrumb, showWindow: true, view: PartnerPageView, backtest: BacktestPanel \| null }` | the slug is not a pilot partner |
| `GET /api/sla/pages/alerts?window=all` | `{ frame, nav, breadcrumb, showWindow: true, view: AlertsView }` | business viewer |
| `GET /api/sla/pages/health` | `{ frame, nav, breadcrumb, showWindow: false, view: { health, unusable } }` | business viewer |
| `GET /api/sla/pages/partners/[partner]/terms` | `{ frame, nav, breadcrumb, showWindow: false, view: { partner, partnerName, row \| null, initial: ContractFormState, services } }` | business viewer, or not a pilot partner |
| `POST /api/sla/contract-terms/[partner]/review` | `{ errors, warnings, terms: ContractTermsBody \| null }` | not a pilot partner; 400 on a malformed body |
| `GET /api/sla/contract-terms/[partner]` | unchanged | |
| `PUT /api/sla/contract-terms/[partner]` | unchanged shape; `updatedBy` is read from `X-Forwarded-User`, not the body | |
| `GET /api/sla/feed`, `GET /api/sla/health`, `POST /api/internal/alerts/run`, the two ingestion routes | unchanged | |

`frame` is the dashboard `Frame` (window key, title, phase and its label, month options with hrefs and labels, as-of label) plus `view: { active }`. `nav` is `NavModel`. `breadcrumb` is the list the pages rendered. Hrefs are app-relative (`/partners/scopely?window=2026-10`); the frontend's hash router renders them as `#/partners/scopely?window=2026-10`, so there is no URL rewriting on either side.

A business viewer gets 404 from the engineer-only pages, as before. The frontend's view toggle sends a business viewer who is on one of those pages to the overview, keeping the window, which is what the deleted `/view/[role]` route did.

### Identity

The page routes log `X-Forwarded-User` with each request. The review and terms routes record it. `PUT` without the header is rejected with 401 in production; outside production the value `dev@xsolla.com` is used so the Vite dev proxy and tests need no header.

### Three model additions

So the frontend never imports `copy.ts` or `view.ts`: `TermView.statusLabel` and `PartnerPageView.worstLabel` carry the status label; `PartnerPageView.unavailableRow` is the tracking row the partner page shows when the feed failed (previously built inside the component); `MonthOption.phaseLabel` and `Frame.phaseLabel` carry the phase label. `OutageLines` takes the reconciliation sentence as a prop.

## 3. Frontend

`apps/sla-tracking` in `xsolla/mini-apps`, scaffolded from the template: Vite, React 19, TypeScript, Tailwind v4 with `@xsolla/xui-tokens`, TanStack Query, `@xsolla/mini-apps` for `redirectToLogin`, `MiniAppErrorBoundary` and `trackVisit`. `react-router-dom` with `HashRouter`, because the bundle is served from a fixed path inside an iframe and the host pins the iframe version with its own `?v=` parameter.

Routes: `/`, `/partners/:partner`, `/partners/:partner/terms` (`?edit=1`), `/alerts`, `/health`. Each reads `window`, `backtest` and `edit` from the hash query, the view preference from `localStorage` (`sla_view`, default `technical`), calls one page endpoint, and renders the shell plus the page. Three states besides success: loading, backend failure (the message, never a zero), and not found.

`API_BASE` is `/api/mini-app-proxy/sla-tracking` in both dev and production. Locally the Vite dev server proxies that prefix to the backend (`SLA_BACKEND_URL`, default `http://localhost:3000`), strips the prefix, drops `origin` and `cookie`, and sets `x-forwarded-user` from `SLA_LOCAL_USER` (default `dev@xsolla.com`), the same stand-in `apps/workflow-studio` uses. No `*.run.app` URL appears anywhere in the frontend; CI rejects it.

The contract terms form validates through `POST …/review` (debounced while typing, once more before save) and saves through the existing `PUT`. It needs no copy of the registry or of `review-contract.ts`.

## 4. Deployment

| Piece | Where | Change |
| --- | --- | --- |
| Backend code | `neuronet-automations/services/sla-dashboard/` (vendored copy of this repo) | re-copied after each backend PR |
| `services.sla-dashboard` | `registry.yaml` | `ingress: all`; `iam_invokers`: ATT proxy SA + runtime SA; description rewritten. `allow_unauthenticated: false`, `cloudsql_instances`, env and secrets unchanged |
| `jobs.sla-alert-run` | `registry.yaml` | `DASHBOARD_INTERNAL_URL` = the live `sla-dashboard` URL; `deploy_hold` removed |
| Backend registration | `all-the-things/config/mini-app-backends.json` | `"sla-tracking": { "url": "<the URL gcloud reports>", "timeout": 60000 }` |
| Access | `all-the-things/config/mini-app-access.json` | `"sla-tracking": { "mode": "everyone" }` |
| Frontend | `mini-apps/apps/sla-tracking`, branch `mini-apps/sla-tracking-v1.0.0` | CD uploads the bundle to GCS and registers the version |

Order: backend endpoints (additive, old pages still served) → registry → ATT config → mini-app 1.0.0 → remove the pages here → re-copy. The old pages stay reachable by IAM-authenticated callers until the mini-app is verified, so nobody loses the dashboard mid-migration.

`docs/deploy.md` is the runbook.

## 5. Testing

Stays here: every engine, data, feed, alerts, ingestion, terms and registry test; the builder tests (`view`, `overview`, `partner-page`, `alerts-view`, `badges`, `model`); new tests for `pages.ts` (shape, hrefs carry the window, backtest only for the requested partner, unknown slug, business 404s, and `JSON.parse(JSON.stringify(page))` equals `page`, which catches a `Set`, `Date` or `Infinity` in a model), the page routes (no-store headers, 404s), the review route, and the business sentinel test, now asserting on the JSON.

Moves to the mini-app: every `renderToStaticMarkup` and DOM test of a component, with the same fixtures, under vitest + happy-dom; one Playwright spec per `qa.views` entry.

Sample envelopes are committed under `tests/app/fixtures/pages/` and deep-equalled against the builders. When the backend shape changes, that diff is the signal to update the frontend's copied types.

## 6. Out of scope, tracked

1. Registering `sla-ingestion` in `neuronet-automations` (entry in `docs/deploy.md`) and pointing Jira Automation and Slack at it.
2. Database connectivity from `xsolla-n8n-prod` to the instance in `gcp-xsolla`: the Cloud SQL connector already in the registry, or Direct VPC egress. Decide with Infra, apply to both services, verify with `sla-alert-run` and a test PIR. This closes the connection-method half of OQ-4.
3. Deriving the role from `X-Forwarded-User` instead of the preference toggle (an AD-5 revision).

## Relationship to the other specs

Main spec: AD-1 (Next.js serves route handlers only; the UI is the mini-app), AD-5 (preference via `?view=`; identity via `X-Forwarded-User`), §4 layout, §6.6 (editor identity resolved), §8.1, §8.3 (new routes), §9.4 (theming lives in the mini-apps template), OQ-4 (SSO half resolved). Dashboard UI design: §3 to §5 (hash routes, loader signature, toggle), §11 module layout, §12 testing. Both are amended in the removal PR. Where they and this document overlap on the split, this document is more detailed.
