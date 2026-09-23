import { resolvePartner, resolveService, type PartnerId, type ServiceId } from "@/registry";
import type { Database } from "./db";
import { slaOutages } from "./schema/outages";

export const UNUSABLE_REASONS = [
  "missing_outage_minutes",
  "invalid_outage_minutes",
  "missing_incident_started",
  "missing_affected_service",
  "unresolved_partner",
  "unresolved_service",
] as const;

export type UnusableReason = (typeof UNUSABLE_REASONS)[number];

/**
 * A row as node-postgres / Drizzle returns it.
 * outageMinutes and partnerId are still strings.
 */
export type OutageSourceRow = {
  id: number;
  pirKey: string;
  partner: string;
  /** Raw sla_outages.partner_id. External merchant id text, not a foreign key. */
  partnerId: string | null;
  incidentStarted: Date | null;
  affectedService: string | null;
  outageMinutes: string | null;
  severity: string | null;
  reviewedBy: string | null;
  decisionType: string | null;
  reason: string | null;
  reviewedAt: Date | null;
  pirUrl: string | null;
};

export type UsableOutage = {
  id: number;
  pirKey: string;
  pirUrl: string | null;
  /** Registry slug. Evaluation groups on this. */
  partnerId: PartnerId;
  /** Parsed sla_outages.partner_id. Null when the row had no merchant id. */
  merchantId: number | null;
  serviceId: ServiceId;
  incidentStarted: Date;
  outageMinutes: number;
  severity: string | null;
  reviewedBy: string | null;
  decisionType: string | null;
  reason: string | null;
  reviewedAt: Date | null;
};

export type UnusableOutage = {
  id: number;
  pirKey: string;
  partner: string;
  affectedService: string | null;
  incidentStarted: Date | null;
  rawOutageMinutes: string | null;
  reasons: UnusableReason[];
};

export type OutagePartition = {
  usable: UsableOutage[];
  unusable: UnusableOutage[];
};

export type OutageHealth = {
  usableCount: number;
  unusableCount: number;
  countsByReason: Record<UnusableReason, number>;
  unresolvedPartnerNames: string[];
  unresolvedServiceNames: string[];
};

function parseMerchantId(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const merchantId = Number(value.trim());
  if (!Number.isSafeInteger(merchantId)) {
    return null;
  }
  return merchantId;
}

function parseOutageMinutes(
  value: string | null,
): { ok: true; minutes: number } | { ok: false; reason: "missing_outage_minutes" | "invalid_outage_minutes" } {
  if (value === null || value.trim() === "") {
    return { ok: false, reason: "missing_outage_minutes" };
  }
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return { ok: false, reason: "invalid_outage_minutes" };
  }
  return { ok: true, minutes };
}

function startedAt(value: Date | null): Date | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

export function partitionOutages(rows: readonly OutageSourceRow[]): OutagePartition {
  const usable: UsableOutage[] = [];
  const unusable: UnusableOutage[] = [];

  for (const row of rows) {
    const reasons: UnusableReason[] = [];
    const minutes = parseOutageMinutes(row.outageMinutes);
    if (!minutes.ok) {
      reasons.push(minutes.reason);
    }

    const incidentStarted = startedAt(row.incidentStarted);
    if (incidentStarted === null) {
      reasons.push("missing_incident_started");
    }

    const partner = resolvePartner(row.partner);
    if (partner.status === "unresolved") {
      reasons.push("unresolved_partner");
    }

    const serviceName = row.affectedService?.trim() ?? "";
    const service = serviceName.length === 0 ? null : resolveService(row.affectedService ?? "");
    if (service === null) {
      reasons.push("missing_affected_service");
    } else if (service.status === "unresolved") {
      reasons.push("unresolved_service");
    }

    if (
      reasons.length > 0 ||
      !minutes.ok ||
      incidentStarted === null ||
      service === null ||
      service.status !== "resolved" ||
      partner.status !== "resolved"
    ) {
      unusable.push({
        id: row.id,
        pirKey: row.pirKey,
        partner: row.partner,
        affectedService: row.affectedService,
        incidentStarted: row.incidentStarted,
        rawOutageMinutes: row.outageMinutes,
        reasons,
      });
      continue;
    }

    usable.push({
      id: row.id,
      pirKey: row.pirKey,
      pirUrl: row.pirUrl,
      partnerId: partner.id,
      merchantId: parseMerchantId(row.partnerId),
      serviceId: service.id,
      incidentStarted,
      outageMinutes: minutes.minutes,
      severity: row.severity,
      reviewedBy: row.reviewedBy,
      decisionType: row.decisionType,
      reason: row.reason,
      reviewedAt: row.reviewedAt,
    });
  }

  return { usable, unusable };
}

export function summarizeOutageHealth(partition: OutagePartition): OutageHealth {
  const countsByReason = Object.fromEntries(UNUSABLE_REASONS.map((reason) => [reason, 0])) as Record<
    UnusableReason,
    number
  >;
  const unresolvedPartnerNames = new Set<string>();
  const unresolvedServiceNames = new Set<string>();

  for (const row of partition.unusable) {
    for (const reason of row.reasons) {
      countsByReason[reason] += 1;
    }
    if (row.reasons.includes("unresolved_partner") && row.partner.trim() !== "") {
      unresolvedPartnerNames.add(row.partner.trim());
    }
    if (
      row.reasons.includes("unresolved_service") &&
      row.affectedService !== null &&
      row.affectedService.trim() !== ""
    ) {
      unresolvedServiceNames.add(row.affectedService.trim());
    }
  }

  return {
    usableCount: partition.usable.length,
    unusableCount: partition.unusable.length,
    countsByReason,
    unresolvedPartnerNames: [...unresolvedPartnerNames].sort(),
    unresolvedServiceNames: [...unresolvedServiceNames].sort(),
  };
}

export async function loadOutages(db: Database): Promise<OutagePartition> {
  const rows = await db.select().from(slaOutages);
  return partitionOutages(rows);
}
