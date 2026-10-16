import { describe, expect, it } from "vitest";
import { buildMonthOptions } from "@/app/dashboard/model";
import { buildNav, withWindow } from "@/app/dashboard/nav";
import { unavailablePartners, type PartnerView } from "@/app/dashboard/view";

function partner(id: string, name: string, overrides: Partial<PartnerView> = {}): PartnerView {
  return {
    id, name, merchantIds: null, terms: [], tracking: [], worst: null, trackingOnly: true, unavailable: false,
    contractTerms: null, backtestEnabled: false, ...overrides,
  };
}

describe("nav", () => {
  it("gives each partner a dot tone from its worst status and keeps the window on every link", () => {
    const nav = buildNav({
      windowKey: "2026-09",
      role: "technical",
      partners: [
        partner("scopely", "Scopely", { worst: "breached", trackingOnly: false }),
        partner("niantic", "Niantic", { worst: "at_risk", trackingOnly: false }),
        partner("kabam", "Kabam", { worst: "meeting", trackingOnly: false }),
        partner("roblox", "Roblox"),
      ],
      alerts: { count: 2 },
      health: { count: 0 },
      active: { kind: "partner", id: "niantic" },
    });
    expect(nav.partners.map((entry) => entry.tone)).toEqual(["breached", "at_risk", "meeting", "tracking"]);
    expect(nav.partners.map((entry) => entry.href)).toEqual(["/partners/scopely?window=2026-09", "/partners/niantic?window=2026-09", "/partners/kabam?window=2026-09", "/partners/roblox?window=2026-09"]);
    expect(nav.active).toEqual({ kind: "partner", id: "niantic" });
    expect(nav.alerts).toEqual({ count: 2 });
    expect(withWindow("/alerts", "2026-09")).toBe("/alerts?window=2026-09");
  });

  it("gives failed partners no dot tone and passes error badges through", () => {
    const nav = buildNav({
      windowKey: "2026-09",
      role: "technical",
      partners: unavailablePartners(null, "technical"),
      alerts: { status: "error" },
      health: { status: "error" },
      active: { kind: "overview" },
    });
    expect(nav.partners.every((entry) => entry.tone === "unknown")).toBe(true);
    expect(nav.partners).toHaveLength(11);
    expect(nav.alerts).toEqual({ status: "error" });
    expect(nav.health).toEqual({ status: "error" });
  });

  it("drops the alerts and health badges for the business role", () => {
    const nav = buildNav({ windowKey: "2026-09", role: "business", partners: [partner("scopely", "Scopely")], alerts: { count: 2 }, health: { count: 1 }, active: { kind: "overview" } });
    expect(nav.role).toBe("business");
    expect(nav.alerts).toBeNull();
    expect(nav.health).toBeNull();
  });

  it("points the month options at the current route, so a partner page keeps its path", () => {
    const months = buildMonthOptions(new Date("2026-09-23T15:58:00.000Z"), "2026-09", "/partners/scopely");
    expect(months[0]).toEqual({ key: "2026-09", title: "September 2026", phase: "open", phaseLabel: "In progress", href: "/partners/scopely?window=2026-09", selected: true });
    expect(months[1]?.phaseLabel).toBe("Settled");
    expect(months.every((month) => month.href.startsWith("/partners/scopely?window="))).toBe(true);
    expect(months.filter((month) => month.selected)).toHaveLength(1);
    expect(buildMonthOptions(new Date("2026-09-23T15:58:00.000Z"), "2026-09")[0]?.href).toBe("/?window=2026-09");
  });
});
