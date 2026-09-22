CREATE TABLE "sla_alert_state" (
	"partner_id" text NOT NULL,
	"scope_id" text NOT NULL,
	"period" text NOT NULL,
	"last_status" text NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"alert_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sla_alert_state_partner_id_scope_id_period_pk" PRIMARY KEY("partner_id","scope_id","period")
);
