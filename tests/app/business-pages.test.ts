import { describe, expect, it } from "vitest";
import type { Workspace } from "@/app/dashboard/load";
import { buildMonthOptions } from "@/app/dashboard/model";
import { alertsPage, healthPage, overviewPage, partnerPage, termsPage } from "@/app/dashboard/pages";
import { buildBusinessPartners } from "@/app/dashboard/view";
import { AS_OF, WINDOW_KEY, evaluateBusinessFeed, scoredOutage, trackingOutage } from "../support/business-feed";

// Nothing engineer-side may reach a business viewer: ticket keys, merchant ids, reviewer names, severities, fixture clauses, engineer routes.
const SENTINELS = ["GTO-", "151639", "503608", "ada", "L1", "FIXTURE", "/alerts", "/health", "/terms", "pirKey", "reviewedBy", "merchantIds\":[\""];

describe("business role", () => {
  it("builds the overview and partner envelopes from a real business evaluation with nothing engineer-side in the JSON", async () => {
    const feed = await evaluateBusinessFeed([scoredOutage(), trackingOutage()]);
    if (feed.role !== "business") throw new Error("expected a business feed");
    // The sentinels only mean something if the evaluation really produced both row kinds.
    expect(feed.rows.some((row) => row.kind === "scored" && row.partnerId === "scopely")).toBe(true);
    expect(feed.rows.some((row) => row.kind === "tracking_only")).toBe(true);

    const workspace: Workspace = {
      role: "business",
      frame: { windowKey: WINDOW_KEY, windowTitle: "April 2026", phase: "open", phaseLabel: "In progress", months: buildMonthOptions(AS_OF, WINDOW_KEY), asOfLabel: "2026-04-20 00:00:00 UTC" },
      partners: buildBusinessPartners(feed.rows, "open", WINDOW_KEY),
      failure: null,
      health: null,
      unusable: null,
      alerts: null,
      view: { active: "business" },
      termsIndex: null,
      backtest: null,
    };
    const overview = JSON.stringify(overviewPage(workspace));
    const page = JSON.stringify(partnerPage(workspace, "scopely"));
    for (const sentinel of SENTINELS) {
      expect(overview, sentinel).not.toContain(sentinel);
      expect(page, sentinel).not.toContain(sentinel);
    }
    const scopely = partnerPage(workspace, "scopely");
    expect(scopely?.view.terms.every((term) => term.tickets === null && term.clause === null && term.outages === null)).toBe(true);
    expect(scopely?.view.tracking.every((row) => row.outages === null)).toBe(true);
    expect(scopely?.view.terms[0]?.trend.bars.length).toBeGreaterThan(0);
    expect(scopely?.view.backtest).toBeNull();
    expect(overview).toContain("Scopely");
    expect(alertsPage(workspace, undefined)).toBeNull();
    expect(healthPage(workspace)).toBeNull();
    expect(termsPage(workspace, "scopely", null)).toBeNull();
  });
});
