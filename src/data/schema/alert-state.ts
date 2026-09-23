import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The only table this application owns. Used later for alert deduplication.
 * partner_slug is the registry slug, for example "second-dinner".
 * It is not sla_outages.partner_id, which is an external merchant id.
 */
export const slaAlertState = pgTable(
  "sla_alert_state",
  {
    partnerSlug: text("partner_slug").notNull(),
    scopeId: text("scope_id").notNull(),
    period: text("period").notNull(),
    lastStatus: text("last_status").notNull(),
    lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
    alertCount: integer("alert_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.partnerSlug, table.scopeId, table.period],
    }),
  ],
);
