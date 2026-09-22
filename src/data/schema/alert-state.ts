import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** The only table this application owns. Used later for alert deduplication. */
export const slaAlertState = pgTable(
  "sla_alert_state",
  {
    partnerId: text("partner_id").notNull(),
    scopeId: text("scope_id").notNull(),
    period: text("period").notNull(),
    lastStatus: text("last_status").notNull(),
    lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
    alertCount: integer("alert_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.partnerId, table.scopeId, table.period],
    }),
  ],
);
