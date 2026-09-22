import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { partitionOutages, slaOutages, summarizeOutageHealth } from "@/data";
import type { OutageSourceRow } from "@/data";

type DriverMinutes = (typeof slaOutages)["$inferSelect"]["outageMinutes"];
const _driverMinutesAreStrings: DriverMinutes extends string ? true : never = true;
void _driverMinutesAreStrings;

function outage(overrides: Partial<OutageSourceRow> = {}): OutageSourceRow {
  return {
    id: 1,
    pirKey: "GTO-100",
    partner: "Scopely",
    incidentStarted: new Date("2026-04-16T12:00:00.000Z"),
    affectedService: "Payments",
    outageMinutes: "10",
    severity: "L1",
    reviewedBy: null,
    decisionType: null,
    reason: null,
    reviewedAt: null,
    pirUrl: null,
    ...overrides,
  };
}

describe("partitionOutages", () => {
  it("sums outage_minutes numerically instead of concatenating numeric strings", () => {
    const result = partitionOutages([
      outage({ id: 1, outageMinutes: "10.50" }),
      outage({ id: 2, pirKey: "GTO-101", outageMinutes: "20.00" }),
    ]);

    expect(result.usable.map((row) => row.outageMinutes)).toEqual([10.5, 20]);
    for (const row of result.usable) {
      expect(typeof row.outageMinutes).toBe("number");
    }

    const sum = result.usable.reduce((total, row) => total + row.outageMinutes, 0);
    expect(sum).toBe(30.5);
    expect(sum).not.toBe("010.5020.00");
  });

  it("places an unusable row in the unusable set with its reason and keeps it out of the usable set", () => {
    const resolved = outage({ id: 1, outageMinutes: "5" });
    const unresolved = outage({
      id: 2,
      pirKey: "GTO-200",
      partner: "Definitely Not A Partner",
      outageMinutes: "15",
    });

    const result = partitionOutages([resolved, unresolved]);

    expect(result.usable.map((row) => row.id)).toEqual([1]);
    expect(result.usable.some((row) => row.id === 2)).toBe(false);
    expect(result.unusable).toEqual([
      expect.objectContaining({
        id: 2,
        pirKey: "GTO-200",
        partner: "Definitely Not A Partner",
        reasons: ["unresolved_partner"],
      }),
    ]);
  });

  it("reports every reason a row cannot be evaluated", () => {
    const result = partitionOutages([
      outage({
        id: 9,
        partner: "Nope",
        affectedService: "Nope Service",
        incidentStarted: null,
        outageMinutes: null,
      }),
    ]);

    expect(result.usable).toEqual([]);
    expect(result.unusable).toHaveLength(1);
    expect(result.unusable[0]?.reasons).toEqual([
      "missing_outage_minutes",
      "missing_incident_started",
      "unresolved_partner",
      "unresolved_service",
    ]);
  });

  it("does not let a non-numeric outage_minutes string into the usable set", () => {
    const result = partitionOutages([outage({ id: 4, outageMinutes: "10minutes" })]);

    expect(result.usable).toEqual([]);
    expect(result.unusable[0]?.reasons).toEqual(["invalid_outage_minutes"]);
  });
});

describe("summarizeOutageHealth", () => {
  it("counts rows by reason and lists the distinct unresolved names", () => {
    const partition = partitionOutages([
      outage({ id: 1, outageMinutes: "10" }),
      outage({ id: 2, partner: "Nope", affectedService: "Not A Service" }),
      outage({ id: 3, partner: "nope", affectedService: "Not A Service" }),
      outage({ id: 4, partner: "Also Missing", affectedService: null, outageMinutes: null }),
    ]);

    const health = summarizeOutageHealth(partition);

    expect(health.usableCount).toBe(1);
    expect(health.unusableCount).toBe(3);
    expect(health.countsByReason.unresolved_partner).toBe(3);
    expect(health.countsByReason.unresolved_service).toBe(2);
    expect(health.countsByReason.missing_affected_service).toBe(1);
    expect(health.countsByReason.missing_outage_minutes).toBe(1);
    expect(health.unresolvedPartnerNames).toEqual(["Also Missing", "Nope", "nope"]);
    expect(health.unresolvedServiceNames).toEqual(["Not A Service"]);
  });
});

describe("sla_alert_state migration", () => {
  it("creates only the table this app owns", () => {
    const migrationsDir = path.join(process.cwd(), "src/data/migrations");
    const sqlFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThan(0);

    const sql = sqlFiles
      .map((name) => readFileSync(path.join(migrationsDir, name), "utf8"))
      .join("\n")
      .toLowerCase();

    expect(sql).toContain("create table");
    expect(sql).toContain("sla_alert_state");
    for (const column of [
      "partner_id",
      "scope_id",
      "period",
      "last_status",
      "last_alerted_at",
      "alert_count",
      "updated_at",
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain("primary key");
    expect(sql).toMatch(/alert_count[\s\S]*default 0/);
    expect(sql).not.toContain("sla_outages");
  });
});
