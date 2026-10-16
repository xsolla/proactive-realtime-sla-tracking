import { describe, expect, it } from "vitest";
import { UNUSABLE_REASONS } from "@/data";
import { healthBadge } from "@/app/dashboard/badges";
import { reasonLabel } from "@/app/dashboard/copy";
import { buildHealth, unusableRows } from "@/app/dashboard/model";
import type { SlaFeed } from "@/feed";

function feedHealth(): SlaFeed["health"] {
  return {
    usableCount: 27, unusableCount: 1,
    countsByReason: { ...Object.fromEntries(UNUSABLE_REASONS.map((reason) => [reason, 0])), missing_outage_minutes: 1 } as SlaFeed["health"]["countsByReason"],
    unresolvedPartnerNames: ["Unknown Co"], unresolvedServiceNames: [], partnersWithZeroAttributedRows: ["mihoyo"],
  };
}

describe("health view", () => {
  it("builds the counts, the unusable rows, and the badge sum excluding partners with no rows", () => {
    const health = buildHealth({
      health: feedHealth(),
      ingestion: { status: "ok", counts: { failed: 1, unresolved: 0, withoutMessage: 0 }, failed: [{ pirKey: "GTO-9", pirUrl: "https://jira.example/browse/GTO-9", error: "Jira fetch failed", updatedAt: "2026-09-01T00:00:00.000Z" }], unresolved: [], withoutMessage: [] },
      invalidTerms: [],
    });
    const rows = unusableRows([{ pirKey: "GTO-7", partner: "Scopely", partnerId: 151639, affectedService: "Payments", incidentStarted: "2026-09-03T10:00:00.000Z", rawOutageMinutes: null, reasons: ["missing_outage_minutes"] }]);
    expect(healthBadge(health)).toEqual({ count: 3 });
    expect(health).toMatchObject({ usableCount: 27, droppedRows: 1, unresolvedPartnerNames: ["Unknown Co"], unmatchedServiceNames: [], partnersWithNoRows: ["miHoYo"] });
    expect(health.reasons).toEqual([{ key: "missing_outage_minutes", label: reasonLabel("missing_outage_minutes"), count: 1 }]);
    expect(rows).toEqual([{ pirKey: "GTO-7", partner: "Scopely", merchantId: "151639", service: "Payments", started: "2026-09-03 10:00:00 UTC", rawMinutes: "", reasons: [reasonLabel("missing_outage_minutes")] }]);
    if (health.ingestion.status !== "ok") throw new Error("expected ok");
    expect(health.ingestion.failed.rows[0]).toMatchObject({ pirKey: "GTO-9", href: "https://jira.example/browse/GTO-9" });
    expect(JSON.stringify(health)).not.toContain("—");
  });

  it("reports an explicit error for a failed source, never a zero", () => {
    expect(healthBadge({ status: "error" })).toEqual({ status: "error" });
    const ingestionDown = buildHealth({ health: feedHealth(), ingestion: { status: "error" }, invalidTerms: [] });
    expect(ingestionDown.ingestion).toEqual({ status: "error" });
    expect(healthBadge(ingestionDown)).toEqual({ status: "error" });
  });

  it("builds each ingestion list with a linked key, a plain key without a URL, and the detail text", () => {
    const health = buildHealth({
      health: feedHealth(),
      ingestion: {
        status: "ok",
        counts: { failed: 2, unresolved: 1, withoutMessage: 0 },
        failed: [
          { pirKey: "GTO-900", pirUrl: "https://jira.example/browse/GTO-900", error: "Jira fetch failed", updatedAt: "2026-09-20T00:00:00.000Z" },
          { pirKey: "GTO-901", pirUrl: null, error: "Missing incident link", updatedAt: "2026-09-19T00:00:00.000Z" },
        ],
        unresolved: [{ pirKey: "GTO-902", pirUrl: "https://jira.example/browse/GTO-902", values: [{ kind: "merchant", raw: "Some Unmatched Studio LLC" }] }],
        withoutMessage: [],
      },
      invalidTerms: [],
    });
    if (health.ingestion.status !== "ok") throw new Error("expected ok");
    expect(health.ingestion.failed.rows.map((row) => `${row.pirKey}:${row.href ?? "plain"}`)).toEqual(["GTO-900:https://jira.example/browse/GTO-900", "GTO-901:plain"]);
    expect(health.ingestion.failed.rows[1]?.detail).toContain("Missing incident link");
    expect(health.ingestion.unresolved.rows[0]?.detail).toContain("Some Unmatched Studio LLC");
    expect(health.ingestion.withoutMessage).toEqual({ count: 0, rows: [] });
  });
});
