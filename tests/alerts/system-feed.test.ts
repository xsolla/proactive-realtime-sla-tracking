import { describe, expect, it, vi } from "vitest";

vi.mock("@/feed", async () => {
  const actual = await vi.importActual<typeof import("@/feed")>("@/feed");
  return {
    ...actual,
    getSlaFeed: vi.fn(async () => ({
      asOf: "2026-09-15T12:00:00.000Z",
      role: "system" as const,
      health: {
        usableCount: 0,
        unusableCount: 0,
        countsByReason: {
          missing_outage_minutes: 0,
          invalid_outage_minutes: 0,
          missing_incident_started: 0,
          invalid_partner_id: 0,
          unresolved_partner: 0,
          missing_affected_service: 0,
          unresolved_service: 0,
          missing_severity: 0,
          unresolved_severity: 0,
        },
        unresolvedPartnerNames: [],
        unresolvedServiceNames: [],
        partnersWithZeroAttributedRows: [],
      },
      rows: [],
    })),
  };
});

import { loadSystemFeed } from "@/alerts";
import { getSlaFeed } from "@/feed";

describe("loadSystemFeed", () => {
  it("calls getSlaFeed with the system viewer and the given instant", async () => {
    const asOf = new Date("2026-09-15T12:00:00.000Z");
    await loadSystemFeed(asOf);

    expect(getSlaFeed).toHaveBeenCalledWith({
      asOf,
      window: {
        start: new Date("2026-09-01T00:00:00.000Z"),
        end: new Date("2026-10-01T00:00:00.000Z"),
      },
      viewer: { role: "system" },
    });
  });
});
