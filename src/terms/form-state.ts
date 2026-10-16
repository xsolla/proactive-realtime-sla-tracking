import { emptyScope, type ContractFormScope, type ContractFormState } from "./review-contract";
import type { ContractFile, ContractScope } from "./types";

export function formStateFromTerms(terms: ContractFile, version: number): ContractFormState {
  return {
    effectiveFrom: terms.effectiveFrom,
    effectiveTo: terms.effectiveTo ?? "",
    contractAggregateCap: terms.contractAggregateCap === null ? "" : String(terms.contractAggregateCap),
    scopes: terms.scopes.map(scopeFromStored),
    expectedVersion: version,
  };
}

function scopeFromStored(scope: ContractScope): ContractFormScope {
  const tiers =
    scope.penalty.kind === "tiers"
      ? scope.penalty.tiers.map((tier, index, all) => ({
          atOrAbove: String(tier.atOrAbove),
          credit: String(tier.credit),
          fixed: index === all.length - 1 && tier.atOrAbove === 0,
        }))
      : emptyScope(scope.scopeId).tiers;
  return {
    scopeId: scope.scopeId,
    kind: scope.kind,
    services: scope.kind === "service" ? [...(scope.services ?? [])] : [],
    includesScopedServices:
      scope.kind === "catch_all"
        ? scope.includesScopedServices === true
          ? "yes"
          : scope.includesScopedServices === false
            ? "no"
            : ""
        : "",
    target: String(scope.target),
    penaltyKind: scope.penalty.kind,
    tiers,
    perScopeCap:
      scope.penalty.kind === "tiers" && scope.penalty.perScopeCap !== null
        ? String(scope.penalty.perScopeCap)
        : "",
    sourceClause: scope.sourceClause ?? "",
  };
}
