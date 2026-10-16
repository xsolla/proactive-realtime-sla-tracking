import { describe, expect, it } from "vitest";
import { QUERY_FAILED, SETTLED_NOTE } from "@/app/dashboard/copy";
import { buildOverview } from "@/app/dashboard/overview";
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
    expect(view.tiles.map((tile) => tile.labelTone)).toEqual(["danger", "warning", "success", undefined]);
    expect(view.attention.map((row) => `${row.partnerId}:${row.term.status}:${row.term.statusLabel}`)).toEqual(["scopely:breached:Breached", "niantic:at_risk:At risk"]);
    expect(view.attention[0]?.href).toBe("/partners/scopely?window=2026-09");
    expect(view.attention[0]?.term.target).toBe("99.950%");
    expect(view.attention[0]?.term.consumedPercent).toBe("351.9% consumed");
    expect(view.attention[1]?.term.credit.text).toBe("no penalty clause → penalty clause, not yet entered");
    expect(view.settledNote).toBe(SETTLED_NOTE);
  });

  it("explains the At risk rule on its tile from the engine constants", () => {
    const view = buildOverview({ partners: partnersWith([]), phase: "open", windowKey: "2026-09", failure: null });
    const help = view.tiles[1]?.help ?? "";
    expect(view.tiles[1]?.label).toBe("At risk");
    expect(help).toContain("at least 20% of the window has elapsed");
    expect(help).toContain("at least 50% of the downtime allowance is used");
    expect(help).toContain("at least 75% of the allowance is used");
    expect(help).toContain("At 100%, the status becomes Breached.");
    expect(help).not.toContain("—");
  });

  it("lists nothing when no term needs attention", () => {
    const view = buildOverview({ partners: partnersWith([]), phase: "open", windowKey: "2026-09", failure: null });
    expect(view.attention).toEqual([]);
    expect(view.settledNote).toBeNull();
  });

  it("marks every tile Unavailable and carries the failure when the feed failed, never zeros", () => {
    const view = buildOverview({ partners: unavailablePartners(null, "technical"), phase: "open", windowKey: "2026-09", failure: QUERY_FAILED });
    expect(view.tiles.every((tile) => tile.value === "Unavailable")).toBe(true);
    expect(view.tiles.every((tile) => tile.tone === "muted")).toBe(true);
    expect(view.summary).toBe("");
    expect(view.failure).toBe(QUERY_FAILED);
    expect(view.attention).toEqual([]);
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
    expect(numeric.attention[0]?.term.credit.text).toBe("10% · 1,000 XXX → 25% · 2,500 XXX");

    const unknown = { kind: "unknown", statement: "penalty clause, not yet entered" } as const;
    const entered = buildOverview({
      partners: partnersWith([scoredRow({ status: "at_risk", penalty: { incurred: unknown, projected: unknown } })]),
      phase: "open", windowKey: "2026-09", failure: null,
    });
    expect(entered.attention[0]?.term.credit.text).toBe("penalty clause, not yet entered");
    expect(entered.attention[0]?.term.credit.incurred).not.toBe("0%");
  });
});
