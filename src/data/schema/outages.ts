import { numeric, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Read-only mirror of the n8n-owned sla_outages table.
 * Do not generate a migration for this table and do not write to it.
 * outage_minutes is numeric, which node-postgres returns as a string.
 * Leave it as a string here. partitionOutages is the only place that parses it.
 */
export const slaOutages = pgTable(
  "sla_outages",
  {
    id: serial("id").primaryKey(),
    pirKey: text("pir_key").notNull(),
    partner: text("partner").notNull(),
    incidentStarted: timestamp("incident_started", { withTimezone: true }).notNull(),
    affectedService: text("affected_service").notNull(),
    outageMinutes: numeric("outage_minutes").notNull(),
    severity: text("severity"),
    reviewedBy: text("reviewed_by"),
    decisionType: text("decision_type"),
    reason: text("reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow(),
    pirUrl: text("pir_url"),
  },
  (table) => [unique("sla_outages_pir_key_partner_key").on(table.pirKey, table.partner)],
);
