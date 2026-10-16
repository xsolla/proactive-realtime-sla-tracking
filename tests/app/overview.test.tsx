import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NO_ATTENTION, QUERY_FAILED, SETTLED_NOTE } from "@/app/dashboard/copy";
import { buildOverview } from "@/app/dashboard/overview";
import { OverviewPage } from "@/app/dashboard/overview-page";
import { buildTechnicalPartners, unavailablePartners } from "@/app/dashboard/view";
import type { TechnicalRow } from "@/feed";
import { scoredRow } from "../support/rows";

function partnersWith(rows: TechnicalRow[]) {
  return buildTechnicalPartners(rows, "open", "2026-09", { withTerms: new Set(["scopely", "niantic"]), bound: new Set(["scopely", "niantic"]), draft: new Set() });
}

describe("overview", () => {
  it("counts terms by status and lists at-risk and breaching terms breaching first", () => {
    const view = buildOverview({
      partners: partnersWith([
        scoredRow({ partner: "niantic", scopeId: "payments", status: "at_risk", usedMinutes: 18, penalty: { incurred: { kind: "none", statement: "no penalty clause" }, projected: { kind: "unknown", statement: "penalty clause, not yet entered" } } }),
        scoredRow({ partner: "scopely", scopeId: "payments", status: "breached", usedMinutes: 76 }),
        scoredRow({ partner: "scopely", scopeId: "login", status: "meeting", usedMinutes: 1, services: ["login"] }),
      ]),
      phase: "settled",
      windowKey: "2026-09",
      failure: null,
    });
    expect(view.summary).toBe("Monitoring 3 SLA terms across 2 partners · 9 partners tracking only.");
    expect(view.tiles.map((tile) => `${tile.label}=${tile.value}`)).toEqual(["Breached=1", "At risk=1", "Meeting=1", "Tracking only=9"]);
    expect(view.tiles[0]?.emphasis).toBe(true);
    expect(view.attention.map((row) => `${row.partnerId}:${row.term.status}`)).toEqual(["scopely:breached", "niantic:at_risk"]);
    expect(view.attention[1]?.term.credit.text).toBe("no penalty clause → penalty clause, not yet entered");
    expect(view.settledNote).toBe(SETTLED_NOTE);

    const html = renderToStaticMarkup(<OverviewPage view={view} />);
    expect(html).toContain(">SLA Breaches/At Risk for Selected Month</h2>");
    expect(html).not.toContain(">Needs attention</h2>");
    expect(html).toMatch(/class="[^"]*text-danger[^"]*">Breached</);
    expect(html).toMatch(/class="[^"]*text-warning[^"]*">At risk</);
    expect(html).toMatch(/class="[^"]*text-success[^"]*">Meeting</);
    expect(html).toContain('aria-label="How At risk is calculated"');
    expect(html).toContain("at least 20% of the window has elapsed");
    expect(html).toContain("at least 50% of the downtime allowance is used");
    expect(html).toContain("at least 75% of the allowance is used");
    expect(html).toContain("At 100%, the status becomes Breached.");
    expect(html).toMatch(/class="[^"]*border-danger[^"]*"/);
    expect(html).toContain("99.950% / ");
    expect(html).toContain("351.9% consumed");
    expect(html).toContain(">Contractual Status<");
    expect(html).toContain(">SLA Consumed<");
    expect(html).not.toContain(">Consumption meter<");
    expect(html).not.toContain(">Error budget<");
    expect(html.match(/<th[^>]*class="[^"]*text-center[^"]*"/g)).toHaveLength(4);
    expect(html).toMatch(/<td class="[^"]*text-center[^"]*"><a href="\/partners\/scopely/);
    expect(html).toMatch(/class="[^"]*text-center[^"]*text-sm[^"]*">351\.9% consumed<\/span>/);
    expect(html).not.toContain(">Credit<");
    expect(html).toContain('href="/partners/scopely?window=2026-09"');
    expect(html).not.toContain("Partner status");
    expect(html).not.toContain("worst first");
    expect(html).not.toContain("—");
  });

  it("renders the empty sentence, not an empty table, when nothing needs attention", () => {
    const view = buildOverview({ partners: partnersWith([]), phase: "open", windowKey: "2026-09", failure: null });
    expect(view.attention).toEqual([]);
    const html = renderToStaticMarkup(<OverviewPage view={view} />);
    expect(html).toContain(NO_ATTENTION);
    expect(html).not.toContain("<table");
  });

  it("renders Unavailable tiles and error rows when the feed failed, never zeros", () => {
    const view = buildOverview({ partners: unavailablePartners(null, "technical"), phase: "open", windowKey: "2026-09", failure: QUERY_FAILED });
    expect(view.tiles.every((tile) => tile.value === "Unavailable")).toBe(true);
    expect(view.summary).toBe("");
    const html = renderToStaticMarkup(<OverviewPage view={view} />);
    expect(html).toContain(QUERY_FAILED);
    expect(html).not.toContain("No terms");
    expect(html).not.toContain("Monitoring");
    // One alert for the header and one for the attention slot.
    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(html).not.toContain("Tracking only</span>");
    expect(html).not.toContain("flagged");
    expect(html).not.toContain(">0<");
  });

  it("keeps incurred and projected credit apart, and never prints 0% for an unentered clause", () => {
    const numeric = buildOverview({
      partners: partnersWith([
        scoredRow({
          status: "at_risk",
          penalty: {
            incurred: { kind: "credit", creditFraction: 0.1, amount: { amount: 1000, currency: "XXX" } },
            projected: { kind: "credit", creditFraction: 0.25, amount: { amount: 2500, currency: "XXX" } },
          },
        }),
      ]),
      phase: "open", windowKey: "2026-09", failure: null,
    });
    const numericHtml = renderToStaticMarkup(<OverviewPage view={numeric} />);
    expect(numeric.attention[0]?.term.credit.text).toBe("10% · 1,000 XXX → 25% · 2,500 XXX");
    expect(numericHtml).not.toContain(">Credit<");
    expect(numericHtml).not.toContain("10% · 1,000 XXX → 25% · 2,500 XXX");
    expect(numericHtml).not.toContain("35%");
    expect(numericHtml).not.toContain("3,500");

    const unknown = { kind: "unknown", statement: "penalty clause, not yet entered" } as const;
    const entered = buildOverview({
      partners: partnersWith([scoredRow({ status: "at_risk", penalty: { incurred: unknown, projected: unknown } })]),
      phase: "open", windowKey: "2026-09", failure: null,
    });
    expect(entered.attention[0]?.term.credit.text).toBe("penalty clause, not yet entered");
    const enteredHtml = renderToStaticMarkup(<OverviewPage view={entered} />);
    expect(enteredHtml).not.toContain(">Credit<");
    expect(enteredHtml).not.toContain("penalty clause, not yet entered");
    expect(enteredHtml).not.toContain("→");
    expect(enteredHtml).not.toMatch(/>0%</);
  });
});
