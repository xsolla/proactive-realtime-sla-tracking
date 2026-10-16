import { describe, expect, it } from "vitest";
import { buildAlertsView } from "@/app/dashboard/alerts-view";
import { alertsBadge } from "@/app/dashboard/badges";
import { ALERTS_NOTE } from "@/app/dashboard/copy";
import { buildTechnicalPartners } from "@/app/dashboard/view";
import { scoredRow } from "../support/rows";

const months = [
  { key: "2026-09", title: "September 2026", phase: "open" as const, phaseLabel: "In progress", href: "/alerts?window=2026-09", selected: true },
  { key: "2026-08", title: "August 2026", phase: "settled" as const, phaseLabel: "Settled", href: "/alerts?window=2026-08", selected: false },
];
const at = (iso: string) => new Date(iso);
const rows = [
  { partnerSlug: "scopely", scopeId: "payments", period: "2026-09", lastStatus: "breached", lastAlertedAt: at("2026-09-20T01:00:00Z"), alertCount: 2, updatedAt: at("2026-09-20T01:00:00Z") },
  { partnerSlug: "kabam", scopeId: "tracking:login", period: "2026-09", lastStatus: "heads_up", lastAlertedAt: at("2026-09-10T13:00:00Z"), alertCount: 1, updatedAt: at("2026-09-10T13:00:00Z") },
  { partnerSlug: "niantic", scopeId: "payments", period: "2026-09", lastStatus: "meeting", lastAlertedAt: null, alertCount: 0, updatedAt: at("2026-09-02T00:00:00Z") },
  { partnerSlug: "niantic", scopeId: "payments", period: "2026-08", lastStatus: "at_risk", lastAlertedAt: at("2026-08-15T01:00:00Z"), alertCount: 1, updatedAt: at("2026-08-15T01:00:00Z") },
];
const partners = buildTechnicalPartners([scoredRow()], "open", "2026-09", null);

describe("alerts view", () => {
  it("lists the selected month, titles scopes, and counts active alerts for the badge", () => {
    const view = buildAlertsView({ alerts: rows, filterKey: "2026-09", months, partners });
    if (view.state !== "ok") throw new Error("expected ok");
    expect(view.note).toBe(ALERTS_NOTE);
    expect(view.rows.map((row) => `${row.partner}:${row.scope}:${row.status}:${row.lastAlerted}`)).toEqual([
      "Scopely:Payments:Breached:2026-09-20 01:00:00 UTC",
      "Kabam:Service: Login:Heads-up:2026-09-10 13:00:00 UTC",
      "Niantic:Payments:Meeting:Never",
    ]);
    expect(view.rows[0]?.href).toBe("/partners/scopely?window=2026-09");
    expect(view.filter.map((option) => option.label)).toEqual(["All months", "September 2026", "August 2026"]);
    expect(alertsBadge(rows, "2026-09")).toEqual({ count: 2 });
    expect(JSON.stringify(view)).not.toContain("—");
  });

  it("marks at_risk and breaching as badges and every other status as a neutral chip", () => {
    const view = buildAlertsView({ alerts: rows, filterKey: "2026-09", months, partners });
    if (view.state !== "ok") throw new Error("expected ok");
    expect(view.rows.map((row) => `${row.status}:${row.statusKind}:${row.badgeVariant}`)).toEqual(["Breached:badge:danger", "Heads-up:chip:warning", "Meeting:chip:warning"]);
    const august = buildAlertsView({ alerts: rows, filterKey: "2026-08", months, partners });
    if (august.state !== "ok") throw new Error("expected ok");
    expect(august.rows.map((row) => `${row.status}:${row.statusKind}:${row.badgeVariant}`)).toEqual(["At risk:badge:warning"]);
  });

  it("marks only the selected filter", () => {
    const view = buildAlertsView({ alerts: rows, filterKey: "2026-09", months, partners });
    if (view.state !== "ok") throw new Error("expected ok");
    expect(view.filter.filter((option) => option.selected).map((option) => option.href)).toEqual(["/alerts?window=2026-09"]);
    expect(view.filter[0]).toEqual({ label: "All months", href: "/alerts?window=all", selected: false });
  });

  it("lists every month under All and writes the empty sentence for a quiet month", () => {
    const all = buildAlertsView({ alerts: rows, filterKey: "all", months, partners });
    expect(all.state === "ok" && all.rows).toHaveLength(4);
    expect(all.state === "ok" && all.empty).toBeNull();
    const quiet = buildAlertsView({ alerts: rows, filterKey: "2026-07", months: [...months, { key: "2026-07", title: "July 2026", phase: "settled", phaseLabel: "Settled", href: "/alerts?window=2026-07", selected: false }], partners });
    expect(quiet.state === "ok" && quiet.empty).toBe("No alerts recorded for July 2026.");
    expect(quiet.state === "ok" && quiet.rows).toEqual([]);
  });

  it("reports the error state, never an empty list, when the read failed", () => {
    const view = buildAlertsView({ alerts: { status: "error" }, filterKey: "2026-09", months, partners });
    expect(view).toEqual({ state: "error" });
    expect(alertsBadge({ status: "error" }, "2026-09")).toEqual({ status: "error" });
  });
});
