import { describe, expect, it } from "vitest";
import { BACKTEST_FAILED, BACKTEST_TRACKING_ONLY, CONTRACT_ON_FILE, NO_TERMS, OUTSIDE_SCOPES, QUERY_FAILED, ROW_UNAVAILABLE, SETTLED_NOTE, TRACKING_ONLY_NOTE } from "@/app/dashboard/copy";
import { toBacktestPanel } from "@/app/dashboard/model";
import { buildPartnerPage } from "@/app/dashboard/partner-page";
import { buildBusinessPartners, buildTechnicalPartners, unavailablePartners } from "@/app/dashboard/view";
import { businessScoredRow, scoredRow, trackingRow } from "../support/rows";

const index = { withTerms: new Set(["scopely"]), bound: new Set(["scopely"]), draft: new Set<string>() };

function technical(rows: Parameters<typeof buildTechnicalPartners>[0], id = "scopely") {
  const partner = buildTechnicalPartners(rows, "open", "2026-09", index).find((entry) => entry.id === id);
  if (partner === undefined) throw new Error("missing partner");
  return partner;
}

describe("partner page", () => {
  it("builds header meta, tiles, terms, and the outside-scope table for a scored partner", () => {
    const view = buildPartnerPage({
      partner: technical([scoredRow(), trackingRow({ service: "login", usedMinutes: 9, incidentCount: 1 })]),
      phase: "open", windowKey: "2026-09", failure: null, role: "technical",
    });
    expect(view.meta).toEqual(["Merchant ID 151639", "1 term"]);
    expect(view.worstLabel).toBe("Breached");
    expect(view.unavailableRow).toBeNull();
    expect(view.termsLink).toEqual({ label: CONTRACT_ON_FILE, href: "/partners/scopely/terms" });
    expect(view.tiles.map((tile) => `${tile.label}=${tile.value}`)).toEqual([
      "Covered services=1", "At risk=1 / 1", "Breached=1", "Downtime this window=76 min",
    ]);
    expect(view.tiles[0]?.detail).toBe("2 outage instances");
    expect(view.tiles[3]?.detail).toBe("of 21.6 min allowed");
    expect(view.trackingHeading).toBe(OUTSIDE_SCOPES);
    expect(view.backtest?.enabled).toBe(true);
    const term = view.terms[0];
    expect(term?.downLine).toBe("76.0 / 21.6 min down");
    expect(term?.consumedPercent).toBe("351.9% consumed");
    expect(term?.tickets?.map((ticket) => `${ticket.key}:${ticket.href ?? "plain"}`)).toEqual(["GTO-601:plain", "GTO-600:https://jira.example/browse/GTO-600"]);
    expect(term?.outages?.[0]?.started).toBeTruthy();
    expect(view.tracking).toHaveLength(1);
  });

  it("builds a tracking-only partner with the note and No terms tiles", () => {
    const view = buildPartnerPage({
      partner: technical([trackingRow({ partner: "kabam" })], "kabam"),
      phase: "settled", windowKey: "2026-09", failure: null, role: "technical",
    });
    expect(view.tiles.map((tile) => tile.value)).toEqual([NO_TERMS, NO_TERMS, NO_TERMS, "42 min"]);
    expect(view.trackingNote).toBe(TRACKING_ONLY_NOTE);
    expect(view.termsLink).toEqual({ label: "Add contract terms", href: "/partners/kabam/terms" });
    expect(view.tracking[0]?.comparison).toBeTruthy();
    expect(view.worstLabel).toBeNull();
  });

  it("builds the business variant without merchant id, backtest, tickets, clause, or outages", () => {
    const partner = buildBusinessPartners([businessScoredRow()], "open", "2026-09").find((entry) => entry.id === "scopely");
    const view = buildPartnerPage({ partner: partner!, phase: "open", windowKey: "2026-09", failure: null, role: "business" });
    expect(view.meta).toEqual(["1 term", "Monthly window"]);
    expect(view.backtest).toBeNull();
    expect(view.termsLink).toBeNull();
    expect(view.tiles.map((tile) => `${tile.label}=${tile.value}`)).toEqual([
      "Covered services=1", "At risk=1 / 1", "Breached=0", "Downtime this window=18.4 min",
    ]);
    expect(view.tiles[0]?.detail).toBeNull();
    const term = view.terms[0];
    expect(term?.tickets).toBeNull();
    expect(term?.clause).toBeNull();
    expect(term?.outages).toBeNull();
    expect(term?.actual).toBe("99.915%");
    expect(term?.trend.bars.length).toBeGreaterThan(0);
    expect(JSON.stringify(view)).not.toContain("151639");
  });

  it("builds the failure state with Unavailable tiles and the error row, never zeros", () => {
    const failed = buildPartnerPage({ partner: unavailablePartners(null, "technical")[0]!, phase: "open", windowKey: "2026-09", failure: QUERY_FAILED, role: "technical" });
    expect(failed.failure).toBe(QUERY_FAILED);
    expect(failed.worstLabel).toBeNull();
    expect(failed.unavailable).toBe(true);
    expect(failed.unavailableRow).toMatchObject({ key: "scopely:unavailable", service: "Unavailable", minutes: "Unavailable", incidents: "Unavailable", comparison: ROW_UNAVAILABLE, outages: null });
    expect(failed.unavailableRow?.trend.bars.at(-1)).toEqual({ month: "2026-09", label: "September 2026", minutes: 0, current: true });
    expect(failed.tiles.every((tile) => tile.value === "Unavailable")).toBe(true);
    expect(failed.terms).toEqual([]);
    expect(failed.tracking).toEqual([]);
    expect(failed.trackingNote).toBeNull();
  });

  it("says no downtime was recorded for a partner without terms or tracking rows", () => {
    const view = buildPartnerPage({ partner: technical([scoredRow()], "kabam"), phase: "open", windowKey: "2026-09", failure: null, role: "technical" });
    expect(view.terms).toEqual([]);
    expect(view.tracking).toEqual([]);
    expect(view.unavailable).toBe(false);
    expect(view.trackingNote).toBe(TRACKING_ONLY_NOTE);
    expect(view.trackingHeading).toBe("Recorded downtime");
  });

  it("shows a true zero for a partner with no downtime, distinct from the unavailable state", () => {
    const idle = buildPartnerPage({ partner: technical([scoredRow()], "niantic"), phase: "open", windowKey: "2026-09", failure: null, role: "technical" });
    const idleDowntime = idle.tiles.find((tile) => tile.label === "Downtime this window");
    expect(idleDowntime?.value).toBe("0 min");
    const failed = buildPartnerPage({ partner: unavailablePartners(null, "technical")[0]!, phase: "open", windowKey: "2026-09", failure: QUERY_FAILED, role: "technical" });
    const failedDowntime = failed.tiles.find((tile) => tile.label === "Downtime this window");
    expect(failedDowntime?.value).toBe("Unavailable");
    expect(failedDowntime?.value).not.toBe(idleDowntime?.value);
    const tracked = buildPartnerPage({ partner: technical([trackingRow({ partner: "niantic", usedMinutes: 42 })], "niantic"), phase: "open", windowKey: "2026-09", failure: null, role: "technical" });
    expect(tracked.tiles.map((tile) => tile.value)).toEqual([NO_TERMS, NO_TERMS, NO_TERMS, "42 min"]);
  });

  it("builds a bound partner's historical replay without turning no-exposure months into zeros", () => {
    const report = {
      range: { description: "as far back as data exists", from: "2026-01-01", through: "2026-03-31" },
      partners: [
        {
          months: [
            { month: "2026-01", exposure: false, scopes: [] },
            {
              month: "2026-03",
              exposure: true,
              scopes: [{ scopeId: "payments", steps: 17, rules: { breaching: 2, trend: 3, level: 4, meeting: 8 } }],
            },
          ],
        },
      ],
    };
    const panel = toBacktestPanel(report);
    if (panel.state !== "ready") throw new Error("expected a ready panel");
    expect(panel.rangeLabel).toBe("as far back as data exists: 2026-01-01 through 2026-03-31");
    expect(panel.rows[0]).toMatchObject({ kind: "none", month: "January 2026", label: "No exposure" });
    expect(panel.rows[1]).toMatchObject({ kind: "counted", month: "March 2026", scope: "payments", steps: "17", breaching: "2", trend: "3", level: "4", meeting: "8" });
    expect(JSON.stringify(panel.rows[0])).not.toContain('"0"');
    expect(BACKTEST_FAILED).toContain("not a result of zero breaches");
  });

  it("disables Backtest with its tooltip for an unbound tracking-only partner, and offers it for a bound one", () => {
    const tracking = buildPartnerPage({ partner: technical([trackingRow({ partner: "kabam" })], "kabam"), phase: "open", windowKey: "2026-09", failure: null, role: "technical" });
    expect(tracking.backtest).toEqual({ enabled: false, windowKey: "2026-09", tooltip: BACKTEST_TRACKING_ONLY });
    const bound = buildPartnerPage({ partner: technical([scoredRow()]), phase: "open", windowKey: "2026-09", failure: null, role: "technical" });
    expect(bound.backtest?.enabled).toBe(true);
  });

  it("carries the settled note and never calls a settled window final", () => {
    const view = buildPartnerPage({ partner: technical([scoredRow()]), phase: "settled", windowKey: "2026-08", failure: null, role: "technical" });
    expect(view.settledNote).toBe(SETTLED_NOTE);
    expect(JSON.stringify(view).toLowerCase()).not.toContain("final");
  });
});
