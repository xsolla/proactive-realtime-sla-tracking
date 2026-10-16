import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, parseFormState } from "@/app/api/sla/contract-terms/[partner]/review/route";
import { emptyContractForm, reviewContractForm, type ContractFormState } from "@/terms";

vi.mock("next/cache", () => ({ unstable_noStore: () => undefined }));

function post(partner: string, body: unknown, raw = false): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/sla/contract-terms/${partner}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-user": "ada@xsolla.com" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
    { params: Promise.resolve({ partner }) },
  );
}

function filledForm(): ContractFormState {
  const form = emptyContractForm();
  form.effectiveFrom = "2026-01-01";
  const scope = form.scopes[0]!;
  scope.kind = "service";
  scope.services = ["payments"];
  scope.target = "99.95";
  scope.penaltyKind = "none";
  return form;
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/sla/contract-terms/[partner]/review", () => {
  it("returns the same errors and warnings reviewContractForm does, and the body a save would send", async () => {
    const form = filledForm();
    const response = await post("roblox", { form });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    const expected = reviewContractForm("roblox", form);
    expect(body).toEqual({ kind: "reviewed", errors: expected.errors, warnings: expected.warnings, terms: { effectiveFrom: "2026-01-01", effectiveTo: null, contractAggregateCap: null, scopes: [{ kind: "service", scopeId: "scope-1", services: ["payments"], target: 99.95, penalty: { kind: "none" }, sourceClause: "" }] } });
    expect(body.errors).toEqual([]);
    expect(body.warnings).toEqual([{ field: "scopes.scope-1.sourceClause", message: expect.stringContaining("No source clause") }]);
  });

  it("reports field errors for an incomplete form with a null body, and never asks for a name", async () => {
    const response = await post("roblox", { form: emptyContractForm() });
    const body = await response.json();
    expect(body.terms).toBeNull();
    expect(body.errors.map((issue: { field: string }) => issue.field)).toContain("effectiveFrom");
    expect(body.errors.some((issue: { field: string }) => issue.field === "updatedBy")).toBe(false);
  });

  it("404s an unknown partner and 400s a malformed body", async () => {
    expect((await post("nobody", { form: filledForm() })).status).toBe(404);
    expect((await post("roblox", "{not json", true)).status).toBe(400);
    expect((await post("roblox", { form: { effectiveFrom: 1 } })).status).toBe(400);
    expect((await post("roblox", { nope: true })).status).toBe(400);
    const scopeless = await post("roblox", { form: { ...filledForm(), scopes: [{ scopeId: "x" }] } });
    expect(scopeless.status).toBe(400);
  });

  it("parses only the form shape, leaving every judgement to the review rules", () => {
    expect(parseFormState(filledForm())).toEqual(filledForm());
    expect(parseFormState({ ...filledForm(), expectedVersion: "3" })).toBeNull();
    expect(parseFormState({ ...filledForm(), expectedVersion: 3 })?.expectedVersion).toBe(3);
    const scope = { ...filledForm().scopes[0]!, kind: "nonsense" };
    expect(parseFormState({ ...filledForm(), scopes: [scope] })).toBeNull();
  });
});
