import type { Evaluation, PartnerScopes, StatusReason } from "@/engine";
import { PARTNERS, SERVICES } from "@/registry";
import type { BusinessRow } from "./types";

export function toBusinessView(
  evaluations: readonly Evaluation[],
  scopes: readonly PartnerScopes[],
): BusinessRow[] {
  return evaluations.map((evaluation) => {
    if (evaluation.kind === "tracking_only") {
      return {
        kind: "tracking_only",
        partner: partnerName(evaluation.partner),
        service: serviceName(evaluation.service),
        usedMinutes: evaluation.usedMinutes,
        incidentCount: evaluation.incidentCount,
        comparison: comparisonSentence(evaluation.comparison.versusMedian),
      };
    }

    return {
      kind: "scored",
      partner: partnerName(evaluation.partner),
      scope: scopeLabel(scopes, evaluation.partner, evaluation.scopeId),
      status: evaluation.status,
      consumedBudget: {
        usedMinutes: evaluation.usedMinutes,
        allowedMinutes: evaluation.allowedMinutes,
        fraction: evaluation.reason.consumedFraction,
      },
      projectedExhaustion: instant(evaluation.projectedExhaustion),
      creditPercentage: {
        incurred: percent(evaluation.penalty.incurred.creditFraction),
        projected: percent(evaluation.penalty.projected.creditFraction),
      },
      summary: renderStatusReason(evaluation.reason),
    };
  });
}

export function renderStatusReason(reason: StatusReason): string {
  if (reason.rule === "breaching") {
    return "Downtime has used the full allowance for this window.";
  }
  if (reason.rule === "trend" && reason.fired.includes("level")) {
    return "Most of the allowance is already used, and the current pace would exhaust it before the window closes.";
  }
  if (reason.rule === "trend") {
    return "At the current pace, downtime will exhaust the allowance before the window closes.";
  }
  if (reason.rule === "level") {
    return "Most of the downtime allowance is already used.";
  }
  return "Downtime is within the allowance at this point in the window.";
}

function comparisonSentence(versus: "above" | "equal" | "below"): string {
  if (versus === "above") {
    return "Above this partner's six-month median.";
  }
  if (versus === "below") {
    return "Below this partner's six-month median.";
  }
  return "Equal to this partner's six-month median.";
}

function percent(creditFraction: number): number {
  return creditFraction * 100;
}

function instant(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function partnerName(id: string): string {
  return PARTNERS.find((partner) => partner.id === id)?.displayName ?? id;
}

function serviceName(id: string): string {
  return SERVICES.find((service) => service.id === id)?.displayName ?? id;
}

function scopeLabel(scopes: readonly PartnerScopes[], partner: string, scopeId: string): string {
  const scope = scopes
    .find((entry) => entry.partner === partner)
    ?.scopes.find((candidate) => candidate.scopeId === scopeId);
  if (scope === undefined) {
    return scopeId;
  }
  if (scope.kind === "service") {
    return serviceName(scope.service);
  }
  if (scope.includesScopedServices) {
    return "All services";
  }
  return "Services without a specific scope";
}
