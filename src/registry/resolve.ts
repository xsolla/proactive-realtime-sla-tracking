import { PARTNERS, type PartnerId } from "./partners";
import { SERVICES, type ServiceId } from "./services";
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

const partnersByName = buildLookup(PARTNERS);
const servicesByName = buildLookup(SERVICES);

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

export function resolvePartner(raw: string): ResolveResult<PartnerId> {
  return resolve(raw, partnersByName);
}

export function resolveService(raw: string): ResolveResult<ServiceId> {
  return resolve(raw, servicesByName);
}
