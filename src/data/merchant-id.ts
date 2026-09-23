export type ParsedMerchantId =
  | { status: "absent" }
  | { status: "invalid"; raw: string }
  | { status: "parsed"; merchantId: number };

/**
 * sla_outages.partner_id is text. Parse it once, here, the same way numeric
 * outage_minutes is parsed: nothing downstream should see the raw string.
 */
export function parseMerchantId(value: string | null): ParsedMerchantId {
  if (value === null || value.trim() === "") {
    return { status: "absent" };
  }
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) {
    return { status: "invalid", raw };
  }
  const merchantId = Number(raw);
  if (!Number.isSafeInteger(merchantId)) {
    return { status: "invalid", raw };
  }
  return { status: "parsed", merchantId };
}
