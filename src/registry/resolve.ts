import { PARTNERS, type PartnerId } from "./partners";
import { SERVICES, type ServiceId } from "./services";
import { SEVERITIES, type SeverityId } from "./severities";
import type { CanonicalEntry, ResolveResult } from "./types";

/** Case-folded, with punctuation removed and whitespace collapsed. */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/ +/g, " ");
}

function buildLookup<Id extends string>(entries: readonly CanonicalEntry<Id>[]): Map<string, Id> {
  const lookup = new Map<string, Id>();

  for (const entry of entries) {
    for (const label of [entry.displayName, ...entry.aliases]) {
      const key = normalizeName(label);
      if (key.length === 0) {
        throw new Error(`Registry label for ${entry.id} normalizes to an empty string`);
      }
      const existing = lookup.get(key);
      if (existing !== undefined && existing !== entry.id) {
        throw new Error(`Registry label "${label}" matches both ${existing} and ${entry.id}`);
      }
      lookup.set(key, entry.id);
    }
  }

  return lookup;
}

function buildMerchantLookup(
  entries: readonly { id: PartnerId; merchantIds: readonly number[] }[],
): Map<number, PartnerId> {
  const lookup = new Map<number, PartnerId>();

  for (const entry of entries) {
    for (const merchantId of entry.merchantIds) {
      const existing = lookup.get(merchantId);
      if (existing !== undefined && existing !== entry.id) {
        throw new Error(`Merchant id ${merchantId} matches both ${existing} and ${entry.id}`);
      }
      lookup.set(merchantId, entry.id);
    }
  }

  return lookup;
}

const partnersByName = buildLookup(PARTNERS);
const partnersByMerchantId = buildMerchantLookup(PARTNERS);
const servicesByName = buildLookup(SERVICES);
const severitiesByName = buildLookup(SEVERITIES);

function resolve<Id extends string>(raw: string, lookup: Map<string, Id>): ResolveResult<Id> {
  const key = normalizeName(raw);
  if (key.length === 0) {
    return { status: "unresolved", raw };
  }
  const id = lookup.get(key);
  if (id === undefined) {
    return { status: "unresolved", raw };
  }
  return { status: "resolved", id };
}

/**
 * Merchant id wins when it is present. The free-text name is used only when
 * the id is absent, which is the backfill case. An unknown id does not fall
 * through to the name.
 */
export function resolvePartner(input: {
  merchantId: number | null;
  name: string;
}): ResolveResult<PartnerId> {
  if (input.merchantId !== null) {
    const id = partnersByMerchantId.get(input.merchantId);
    if (id !== undefined) {
      return { status: "resolved", id };
    }
    return { status: "unresolved", raw: String(input.merchantId) };
  }
  return resolve(input.name, partnersByName);
}

export function resolveService(raw: string): ResolveResult<ServiceId> {
  return resolve(raw, servicesByName);
}

export function resolveSeverity(raw: string): ResolveResult<SeverityId> {
  return resolve(raw, severitiesByName);
}
