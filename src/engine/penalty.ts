import type { Money, PenaltyFigure, PenaltyTier, SlaScope } from "./types";

export function rawCredit(minutes: number, windowMinutes: number, tiers: readonly PenaltyTier[]): number {
  if (!(windowMinutes > 0)) {
    return 0;
  }
  const availability = 1 - minutes / windowMinutes;
  let worst = 0;
  for (const tier of tiers) {
    if (availability < tier.belowAvailability && tier.creditFraction > worst) {
      worst = tier.creditFraction;
    }
  }
  return worst;
}

export function capAt(fraction: number, cap: number | null): number {
  if (cap === null) {
    return fraction;
  }
  return Math.min(fraction, cap);
}

/**
 * Per-scope caps are applied by the caller first. When the sum of those
 * credits still exceeds the contract cap, every scope is scaled by the same
 * factor so the sum equals the cap. Order of scopes does not change the result.
 */
export function scaleToAggregate(fractions: readonly number[], cap: number | null): number[] {
  if (cap === null) {
    return [...fractions];
  }
  const sum = fractions.reduce((total, fraction) => total + fraction, 0);
  if (!(sum > cap)) {
    return [...fractions];
  }
  const factor = cap / sum;
  return fractions.map((fraction) => fraction * factor);
}

export function sharedAggregateCap(scopes: readonly SlaScope[]): number | null {
  let cap: number | null = null;
  for (const scope of scopes) {
    const stated = scope.terms.contractAggregateCap;
    if (stated === null) {
      continue;
    }
    if (cap === null) {
      cap = stated;
      continue;
    }
    if (cap !== stated) {
      throw new Error(
        `contractAggregateCap differs across scopes (${cap} and ${stated}). The engine will not pick one.`,
      );
    }
  }
  return cap;
}

export function penaltyFigure(creditFraction: number, fee: Money | null): PenaltyFigure {
  return {
    creditFraction,
    amount: fee === null ? null : { amount: creditFraction * fee.amount, currency: fee.currency },
  };
}
