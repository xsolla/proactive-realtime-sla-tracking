import { describe, expect, it } from "vitest";
import type { AlertStateRow, ContractTermsRow } from "@/data";
import type { Workspace } from "@/app/dashboard/load";
import { buildHealth, buildMonthOptions } from "@/app/dashboard/model";
import { alertsPage, healthPage, overviewPage, partnerPage, termsPage } from "@/app/dashboard/pages";
import { buildBusinessPartners, buildTechnicalPartners, unavailablePartners } from "@/app/dashboard/view";
import { QUERY_FAILED, reasonLabel } from "@/app/dashboard/copy";
import type { SlaFeed } from "@/feed";
import { businessScoredRow, businessTrackingRow, scoredRow, trackingRow } from "../support/rows";

const AS_OF = new Date("2026-09-23T15:58:00.000Z");
const WINDOW_KEY = "2026-09";

const alertRow: AlertStateRow = {
  partnerSlug: "scopely",
  scopeId: "payments",
  period: WINDOW_KEY,
  lastStatus: "breached",
  lastAlertedAt: new Date("2026-09-20T01:00:00.000Z"),
  alertCount: 2,
  updatedAt: new Date("2026-09-20T01:00:00.000Z"),
};

const feedHealth: SlaFeed["health"] = {
  usableCount: 3,
  unusableCount: 1,
  countsByReason: { unresolved_partner: 1 } as SlaFeed["health"]["countsByReason"],
  unresolvedPartnerNames: ["Unknown Co"],
  unresolvedServiceNames: [],
  partnersWithZeroAttributedRows: ["niantic"],
};

function frame(windowPath = "/") {
  return {
    windowKey: WINDOW_KEY,
    windowTitle: "September 2026",
    phase: "open" as const,
    phaseLabel: "In progress",
    months: buildMonthOptions(AS_OF, WINDOW_KEY, windowPath),
    asOfLabel: "2026-09-23 15:58:00 UTC",
  };
}

const termsIndex = { withTerms: new Set(["scopely"]), bound: new Set(["scopely"]), draft: new Set<string>() };

function technical(overrides: Partial<Workspace> = {}): Workspace {
  return {
    role: "technical",
    frame: frame(),
    partners: buildTechnicalPartners([scoredRow(), trackingRow({ service: "login", usedMinutes: 9, incidentCount: 1 })], "open", WINDOW_KEY, termsIndex),
    failure: null,
    health: buildHealth({
      health: feedHealth,
      ingestion: { status: "ok", counts: { failed: 1, unresolved: 0, withoutMessage: 0 }, failed: [{ pirKey: "GTO-9", pirUrl: null, error: "Jira fetch failed", updatedAt: "2026-09-01T00:00:00.000Z" }], unresolved: [], withoutMessage: [] },
      invalidTerms: [],
    }),
    unusable: null,
    alerts: [alertRow],
    view: { active: "technical" },
    termsIndex,
    backtest: null,
    ...overrides,
  };
}

function business(): Workspace {
  return {
    role: "business",
    frame: frame(),
    partners: buildBusinessPartners([businessScoredRow(), businessTrackingRow()], "open", WINDOW_KEY),
    failure: null,
    health: null,
    unusable: null,
    alerts: null,
    view: { active: "business" },
    termsIndex: null,
    backtest: null,
  };
}

function failed(): Workspace {
  return technical({
    partners: unavailablePartners(termsIndex, "technical"),
    failure: QUERY_FAILED,
    health: { status: "error" },
    alerts: { status: "error" },
  });
}

const termsRow: ContractTermsRow = {
  partnerSlug: "scopely",
  lifecycle: "contract_bound",
  version: 3,
  updatedBy: "j.patel@xsolla.com",
  updatedAt: new Date("2026-09-10T12:00:00.000Z"),
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  terms: {
    partner: "scopely",
    lifecycle: "contract_bound",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    contractAggregateCap: null,
    scopes: [{ kind: "service", scopeId: "payments", services: ["payments"], target: 99.95, penalty: { kind: "tiers", tiers: [{ atOrAbove: 99.9, credit: 5 }, { atOrAbove: 0, credit: 10 }], perScopeCap: null }, sourceClause: "§4.2" }],
  },
};

function roundTrips(page: unknown) {
  expect(JSON.parse(JSON.stringify(page))).toEqual(page);
}

describe("page envelopes", () => {
  it("builds the overview with the frame, nav, breadcrumb and hrefs that carry the window", () => {
    const page = overviewPage(technical());
    expect(page.breadcrumb).toEqual([{ label: "Overview" }]);
    expect(page.showWindow).toBe(true);
    expect(page.frame.view).toEqual({ active: "technical" });
    expect(page.frame.phaseLabel).toBe("In progress");
    expect(page.nav.active).toEqual({ kind: "overview" });
    expect(page.nav.alerts).toEqual({ count: 1 });
    expect(page.nav.health).toEqual({ count: 3 });
    expect(page.nav.partners.every((partner) => partner.href.endsWith(`?window=${WINDOW_KEY}`))).toBe(true);
    expect(page.view.tiles.map((tile) => `${tile.label}=${tile.value}`)).toEqual(["Breached=1", "At risk=0", "Meeting=0", "Tracking only=10"]);
    expect(page.view.attention[0]?.href).toBe(`/partners/scopely?window=${WINDOW_KEY}`);
    roundTrips(page);
  });

  it("builds a partner page, attaches the backtest only for the requested partner, and returns null for an unknown slug", () => {
    const panel = { state: "error" as const, message: "Backtest failed." };
    const workspace = technical({ backtest: { partner: "scopely", panel } });
    const scopely = partnerPage(workspace, "scopely");
    expect(scopely?.breadcrumb).toEqual([{ label: "← Overview", href: `/?window=${WINDOW_KEY}` }, { label: "Scopely" }]);
    expect(scopely?.nav.active).toEqual({ kind: "partner", id: "scopely" });
    expect(scopely?.view.worstLabel).toBe("Breached");
    expect(scopely?.view.terms[0]?.statusLabel).toBe("Breached");
    expect(scopely?.backtest).toEqual(panel);
    expect(partnerPage(workspace, "niantic")?.backtest).toBeNull();
    expect(partnerPage(workspace, "nobody")).toBeNull();
    roundTrips(scopely);
  });

  it("builds the alerts page with the month filter, and lists every month on request", () => {
    const page = alertsPage(technical(), undefined);
    expect(page?.breadcrumb).toEqual([{ label: "Alerts" }]);
    expect(page?.view).toMatchObject({ state: "ok" });
    if (page?.view.state !== "ok") throw new Error("expected rows");
    expect(page.view.rows).toHaveLength(1);
    expect(page.view.rows[0]?.lastAlerted).toBe("2026-09-20 01:00:00 UTC");
    expect(page.view.filter.find((entry) => entry.selected)?.label).toBe("September 2026");
    const all = alertsPage(technical(), "all");
    if (all?.view.state !== "ok") throw new Error("expected rows");
    expect(all.view.filter[0]).toEqual({ label: "All months", href: "/alerts?window=all", selected: true });
    roundTrips(page);
    roundTrips(all);
  });

  it("builds the health page without the month picker, with unusable rows when they were loaded", () => {
    const page = healthPage(technical());
    expect(page?.showWindow).toBe(false);
    expect(page?.view.unusable).toBeNull();
    expect(page?.view.health).toMatchObject({ droppedRows: 1, unresolvedPartnerNames: ["Unknown Co"] });
    const loaded = healthPage(technical({ unusable: [{ pirKey: "GTO-7", partner: "Nobody", partnerId: null, affectedService: null, incidentStarted: null, rawOutageMinutes: "x", reasons: ["unresolved_partner"] }] }));
    expect(loaded?.view.unusable).toEqual([{ pirKey: "GTO-7", partner: "Nobody", merchantId: "", service: "", started: "", rawMinutes: "x", reasons: [reasonLabel("unresolved_partner")] }]);
    roundTrips(page);
    roundTrips(loaded);
  });

  it("builds the terms page with the stored row, the form's initial state and the service options", () => {
    const page = termsPage(technical(), "scopely", termsRow);
    expect(page?.showWindow).toBe(false);
    expect(page?.breadcrumb.map((crumb) => crumb.label)).toEqual(["Overview", "Scopely", "Contract terms"]);
    expect(page?.view.row).toMatchObject({ lifecycle: "contract_bound", version: 3, updatedBy: "j.patel@xsolla.com", updatedAt: "2026-09-10T12:00:00.000Z" });
    expect(page?.view.initial.expectedVersion).toBe(3);
    expect(page?.view.initial.scopes[0]).toMatchObject({ scopeId: "payments", kind: "service", services: ["payments"], target: "99.95", penaltyKind: "tiers" });
    expect(page?.view.services.map((service) => service.displayName)).toEqual([...(page?.view.services ?? [])].map((service) => service.displayName).sort((left, right) => left.localeCompare(right)));
    expect(page?.view.services.some((service) => service.id === "payments")).toBe(true);
    const fresh = termsPage(technical(), "scopely", null);
    expect(fresh?.view.row).toBeNull();
    expect(fresh?.view.initial.expectedVersion).toBeNull();
    expect(fresh?.view.initial.scopes).toHaveLength(1);
    roundTrips(page);
    roundTrips(fresh);
  });

  it("returns null for the engineer-only pages in the business role, and keeps engineer material out of the rest", () => {
    const workspace = business();
    expect(alertsPage(workspace, undefined)).toBeNull();
    expect(healthPage(workspace)).toBeNull();
    expect(termsPage(workspace, "scopely", null)).toBeNull();
    const overview = overviewPage(workspace);
    expect(overview.nav.alerts).toBeNull();
    expect(overview.nav.health).toBeNull();
    const scopely = partnerPage(workspace, "scopely");
    expect(scopely?.view.backtest).toBeNull();
    expect(scopely?.view.termsLink).toBeNull();
    expect(scopely?.view.terms.every((term) => term.tickets === null && term.clause === null && term.outages === null)).toBe(true);
    const serialised = JSON.stringify([overview, scopely]);
    for (const sentinel of ["GTO-", "merchantIds\":[\"", "reviewedBy", "pirKey"]) expect(serialised).not.toContain(sentinel);
    roundTrips(overview);
    roundTrips(scopely);
  });

  it("keeps the failure state honest: unavailable rows and error badges, never zeros", () => {
    const workspace = failed();
    const overview = overviewPage(workspace);
    expect(overview.view.failure).toBe(QUERY_FAILED);
    expect(overview.view.tiles.every((tile) => tile.value === "Unavailable")).toBe(true);
    expect(overview.nav.alerts).toEqual({ status: "error" });
    expect(overview.nav.health).toEqual({ status: "error" });
    const scopely = partnerPage(workspace, "scopely");
    expect(scopely?.view.unavailableRow?.service).toBe("Unavailable");
    const alerts = alertsPage(workspace, undefined);
    expect(alerts?.view).toEqual({ state: "error" });
    const health = healthPage(workspace);
    expect(health?.view.health).toEqual({ status: "error" });
    roundTrips(overview);
    roundTrips(scopely);
    roundTrips(alerts);
    roundTrips(health);
  });

  it("matches the committed sample envelopes the mini-app's types are copied from", async () => {
    const samples: [string, unknown][] = [
      ["overview.technical", overviewPage(technical())],
      ["overview.business", overviewPage(business())],
      ["overview.failed", overviewPage(failed())],
      ["partner.technical", partnerPage(technical({ backtest: { partner: "scopely", panel: { state: "error", message: "Backtest failed." } } }), "scopely")],
      ["partner.business", partnerPage(business(), "scopely")],
      ["partner.failed", partnerPage(failed(), "scopely")],
      ["alerts.technical", alertsPage(technical(), undefined)],
      ["health.technical", healthPage(technical())],
      ["terms.technical", termsPage(technical(), "scopely", termsRow)],
      ["terms.empty", termsPage(technical(), "scopely", null)],
    ];
    for (const [name, page] of samples) {
      await expect(`${JSON.stringify(page, null, 2)}\n`).toMatchFileSnapshot(`./fixtures/pages/${name}.json`);
    }
  });
});
