import { PARTNERS, resolvePartner, type PartnerId } from "@/registry";
import { parseMerchantId } from "./merchant-id";

export type ObservedPartnerPair = {
  partnerId: string | null;
  partner: string;
  rowCount: number;
};

export type UnknownPartnerId = {
  partnerId: string;
  partner: string;
  rowCount: number;
};

export type NameDisagreement =
  | {
      kind: "one_id_many_names";
      merchantId: number;
      names: string[];
      rowCount: number;
    }
  | {
      kind: "one_name_many_ids";
      partner: string;
      merchantIds: number[];
      rowCount: number;
    };

export type ConfirmedPartnerId = {
  merchantId: number;
  partnerSlug: PartnerId;
  displayName: string;
  rowCount: number;
  names: string[];
};

export type ZeroCoveragePartner = {
  id: PartnerId;
  displayName: string;
  merchantIds: readonly number[];
};

export type RegistryReport = {
  unknownIds: UnknownPartnerId[];
  nameDisagreements: NameDisagreement[];
  zeroCoverage: ZeroCoveragePartner[];
  confirmed: ConfirmedPartnerId[];
  hasBlockingFindings: boolean;
};

const partnerByMerchantId = new Map<number, (typeof PARTNERS)[number]>();
for (const partner of PARTNERS) {
  for (const merchantId of partner.merchantIds) {
    partnerByMerchantId.set(merchantId, partner);
  }
}

export function classifyPartnerCoverage(pairs: readonly ObservedPartnerPair[]): RegistryReport {
  const unknown = new Map<string, UnknownPartnerId>();
  const namesByMerchantId = new Map<number, { names: Set<string>; rowCount: number }>();
  const idsByName = new Map<string, { merchantIds: Set<number>; rowCount: number }>();
  const confirmed = new Map<
    number,
    { partnerSlug: PartnerId; displayName: string; rowCount: number; names: Set<string> }
  >();
  const covered = new Set<PartnerId>();

  for (const pair of pairs) {
    const name = pair.partner.trim();
    const parsed = parseMerchantId(pair.partnerId);

    if (parsed.status === "absent") {
      const resolved = resolvePartner({ merchantId: null, name: pair.partner });
      if (resolved.status === "resolved") {
        covered.add(resolved.id);
      }
      continue;
    }

    if (parsed.status === "invalid") {
      addUnknown(unknown, parsed.raw, name, pair.rowCount);
      continue;
    }

    const partner = partnerByMerchantId.get(parsed.merchantId);
    if (partner === undefined) {
      addUnknown(unknown, pair.partnerId?.trim() ?? String(parsed.merchantId), name, pair.rowCount);
    } else {
      covered.add(partner.id);
      const current = confirmed.get(parsed.merchantId) ?? {
        partnerSlug: partner.id,
        displayName: partner.displayName,
        rowCount: 0,
        names: new Set<string>(),
      };
      current.rowCount += pair.rowCount;
      current.names.add(name);
      confirmed.set(parsed.merchantId, current);
    }

    const byId = namesByMerchantId.get(parsed.merchantId) ?? { names: new Set<string>(), rowCount: 0 };
    byId.names.add(name);
    byId.rowCount += pair.rowCount;
    namesByMerchantId.set(parsed.merchantId, byId);

    const byName = idsByName.get(name) ?? { merchantIds: new Set<number>(), rowCount: 0 };
    byName.merchantIds.add(parsed.merchantId);
    byName.rowCount += pair.rowCount;
    idsByName.set(name, byName);
  }

  const unknownIds = [...unknown.values()].sort((left, right) => {
    const leftKey = unknownSortKey(left.partnerId);
    const rightKey = unknownSortKey(right.partnerId);
    if (leftKey[0] !== rightKey[0]) {
      return leftKey[0] - rightKey[0];
    }
    if (leftKey[1] !== rightKey[1]) {
      return leftKey[1] < rightKey[1] ? -1 : 1;
    }
    return left.partner.localeCompare(right.partner);
  });

  const nameDisagreements: NameDisagreement[] = [];
  for (const [merchantId, group] of [...namesByMerchantId.entries()].sort((left, right) => left[0] - right[0])) {
    if (group.names.size > 1) {
      nameDisagreements.push({
        kind: "one_id_many_names",
        merchantId,
        names: [...group.names].sort(),
        rowCount: group.rowCount,
      });
    }
  }
  for (const [partner, group] of [...idsByName.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    if (group.merchantIds.size > 1) {
      nameDisagreements.push({
        kind: "one_name_many_ids",
        partner,
        merchantIds: [...group.merchantIds].sort((left, right) => left - right),
        rowCount: group.rowCount,
      });
    }
  }

  return {
    unknownIds,
    nameDisagreements,
    zeroCoverage: PARTNERS.filter((partner) => !covered.has(partner.id)).map((partner) => ({
      id: partner.id,
      displayName: partner.displayName,
      merchantIds: partner.merchantIds,
    })),
    confirmed: [...confirmed.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([merchantId, row]) => ({
        merchantId,
        partnerSlug: row.partnerSlug,
        displayName: row.displayName,
        rowCount: row.rowCount,
        names: [...row.names].sort(),
      })),
    hasBlockingFindings: unknownIds.length > 0 || nameDisagreements.length > 0,
  };
}

function addUnknown(
  unknown: Map<string, UnknownPartnerId>,
  partnerId: string,
  partner: string,
  rowCount: number,
): void {
  const key = `${partnerId}\0${partner}`;
  const current = unknown.get(key);
  if (current) {
    current.rowCount += rowCount;
    return;
  }
  unknown.set(key, { partnerId, partner, rowCount });
}

function unknownSortKey(partnerId: string): [number, number | string] {
  const parsed = parseMerchantId(partnerId);
  if (parsed.status === "parsed") {
    return [0, parsed.merchantId];
  }
  return [1, partnerId];
}
