import { defineConfig } from "drizzle-kit";

/**
 * sla_outages is owned by the n8n pipeline and is intentionally absent here.
 * Generating from this config must never emit a migration against it.
 */
export default defineConfig({
  schema: "./src/data/schema/alert-state.ts",
  out: "./src/data/migrations",
  dialect: "postgresql",
});
