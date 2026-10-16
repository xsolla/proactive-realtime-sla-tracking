import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { forwardedUser } from "@/app/api/forwarded-user";
import { isPartnerId } from "@/registry";
import {
  contractBodyFromForm,
  reviewContractForm,
  type ContractFormScope,
  type ContractFormState,
  type ContractFormTier,
} from "@/terms";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Validates a contract terms form for the mini-app, which holds no copy of
 * the registry or the review rules. Returns the field errors and warnings
 * `reviewContractForm` produces and the body a save would send, or null while
 * the form is incomplete. Nothing is written; the PUT route reviews again.
 */
export async function POST(request: Request, context: { params: Promise<{ partner: string }> }): Promise<NextResponse> {
  noStore();
  const { partner } = await context.params;
  if (!isPartnerId(partner)) {
    return json({ kind: "not_found" }, 404);
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ kind: "invalid", message: "Request body must be JSON." }, 400);
  }
  const form = isRecord(payload) ? parseFormState(payload.form) : null;
  if (form === null) {
    return json({ kind: "invalid", message: "Request body must be { form: ContractFormState }." }, 400);
  }
  console.info(`[sla-dashboard] terms review ${partner} viewer=${forwardedUser(request) ?? "none"}`);
  const review = reviewContractForm(partner, form);
  return json({ kind: "reviewed", errors: review.errors, warnings: review.warnings, terms: contractBodyFromForm(form) }, 200);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Shape check only: every field is a string the review rules then judge. */
export function parseFormState(value: unknown): ContractFormState | null {
  if (!isRecord(value) || !Array.isArray(value.scopes)) {
    return null;
  }
  const effectiveFrom = str(value.effectiveFrom);
  const effectiveTo = str(value.effectiveTo);
  const contractAggregateCap = str(value.contractAggregateCap);
  const expectedVersion = value.expectedVersion === null ? null : typeof value.expectedVersion === "number" && Number.isInteger(value.expectedVersion) ? value.expectedVersion : undefined;
  if (effectiveFrom === null || effectiveTo === null || contractAggregateCap === null || expectedVersion === undefined) {
    return null;
  }
  const scopes: ContractFormScope[] = [];
  for (const entry of value.scopes) {
    const scope = parseScope(entry);
    if (scope === null) {
      return null;
    }
    scopes.push(scope);
  }
  return { effectiveFrom, effectiveTo, contractAggregateCap, scopes, expectedVersion };
}

function parseScope(value: unknown): ContractFormScope | null {
  if (!isRecord(value) || !Array.isArray(value.services) || !Array.isArray(value.tiers)) {
    return null;
  }
  const scopeId = str(value.scopeId);
  const kind = oneOf(value.kind, ["", "service", "catch_all"] as const);
  const includesScopedServices = oneOf(value.includesScopedServices, ["", "yes", "no"] as const);
  const target = str(value.target);
  const penaltyKind = oneOf(value.penaltyKind, ["", "none", "not_entered", "tiers"] as const);
  const perScopeCap = str(value.perScopeCap);
  const sourceClause = str(value.sourceClause);
  if (scopeId === null || kind === null || includesScopedServices === null || target === null || penaltyKind === null || perScopeCap === null || sourceClause === null) {
    return null;
  }
  if (!value.services.every((service) => typeof service === "string")) {
    return null;
  }
  const tiers: ContractFormTier[] = [];
  for (const entry of value.tiers) {
    if (!isRecord(entry) || typeof entry.atOrAbove !== "string" || typeof entry.credit !== "string" || typeof entry.fixed !== "boolean") {
      return null;
    }
    tiers.push({ atOrAbove: entry.atOrAbove, credit: entry.credit, fixed: entry.fixed });
  }
  return { scopeId, kind, services: value.services as string[], includesScopedServices, target, penaltyKind, tiers, perScopeCap, sourceClause };
}
