import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { classifyPartnerCoverage, type ObservedPartnerPair, type RegistryReport } from "@/data";

/**
 * Read-only report of where sla_outages disagrees with the partner registry.
 * This file issues one SELECT. It does not change the database or the registry.
 */

const PAIRS_QUERY = `
  SELECT partner_id, partner, COUNT(*)::int AS row_count
  FROM sla_outages
  GROUP BY partner_id, partner
  ORDER BY partner_id NULLS LAST, partner
`;

function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (!existsSync(".env")) {
    throw new Error("DATABASE_URL is required");
  }
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1 || trimmed.slice(0, separator).trim() !== "DATABASE_URL") {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  throw new Error("DATABASE_URL is required");
}

function table(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)),
  );
  const format = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ");
  if (rows.length === 0) {
    return ["  (none)"];
  }
  return [format(headers), ...rows.map(format)];
}

function printReport(report: RegistryReport): void {
  console.log("1. UNKNOWN IDS");
  console.log(
    table(
      ["partner_id", "partner", "rows"],
      report.unknownIds.map((row) => [row.partnerId, row.partner, String(row.rowCount)]),
    ).join("\n"),
  );
  console.log("");

  console.log("2. NAME DISAGREEMENT");
  console.log(
    table(
      ["kind", "key", "values", "rows"],
      report.nameDisagreements.map((row) =>
        row.kind === "one_id_many_names"
          ? ["one id, many names", String(row.merchantId), row.names.join(" | "), String(row.rowCount)]
          : ["one name, many ids", row.partner, row.merchantIds.join(" | "), String(row.rowCount)],
      ),
    ).join("\n"),
  );
  console.log("");

  console.log("3. ZERO COVERAGE");
  console.log(
    table(
      ["slug", "display name", "merchant ids"],
      report.zeroCoverage.map((partner) => [
        partner.id,
        partner.displayName,
        partner.merchantIds.join(", "),
      ]),
    ).join("\n"),
  );
  console.log("");

  console.log("4. CONFIRMED");
  console.log(
    table(
      ["merchant id", "slug", "display name", "rows", "names"],
      report.confirmed.map((row) => [
        String(row.merchantId),
        row.partnerSlug,
        row.displayName,
        String(row.rowCount),
        row.names.join(" | "),
      ]),
    ).join("\n"),
  );
  console.log("");

  console.log("SUMMARY");
  console.log(
    table(
      ["category", "count"],
      [
        ["unknown ids", String(report.unknownIds.length)],
        ["name disagreements", String(report.nameDisagreements.length)],
        ["zero coverage", String(report.zeroCoverage.length)],
        ["confirmed", String(report.confirmed.length)],
      ],
    ).join("\n"),
  );
}

export async function verifyRegistry(connectionString: string): Promise<RegistryReport> {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query<{
      partner_id: string | null;
      partner: string | null;
      row_count: number | string;
    }>(PAIRS_QUERY);
    const pairs: ObservedPartnerPair[] = result.rows.map((row) => {
      const rowCount = Number(row.row_count);
      if (!Number.isSafeInteger(rowCount)) {
        throw new Error("Unexpected row count from sla_outages");
      }
      return {
        partnerId: row.partner_id,
        partner: row.partner ?? "",
        rowCount,
      };
    });
    return classifyPartnerCoverage(pairs);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const report = await verifyRegistry(databaseUrl());
  printReport(report);
  if (report.hasBlockingFindings) {
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv.some((argument) => argument.endsWith("verify-registry.ts"));
if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Registry verification failed");
    process.exitCode = 1;
  });
}
