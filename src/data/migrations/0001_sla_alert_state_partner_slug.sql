ALTER TABLE "sla_alert_state" RENAME COLUMN "partner_id" TO "partner_slug";
--> statement-breakpoint
ALTER TABLE "sla_alert_state" RENAME CONSTRAINT "sla_alert_state_partner_id_scope_id_period_pk" TO "sla_alert_state_partner_slug_scope_id_period_pk";
