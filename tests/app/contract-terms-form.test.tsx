/** @vitest-environment happy-dom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TermsForm } from "@/app/partners/[partner]/terms/terms-form";
import { emptyContractForm, type ContractFormState } from "@/terms/review-contract";

function readyForm(expectedVersion: number | null = null): ContractFormState {
  return {
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
    contractAggregateCap: "",
    scopes: [
      {
        scopeId: "payments",
        kind: "service",
        services: ["payments"],
        includesScopedServices: "",
        target: "97.25",
        penaltyKind: "none",
        tiers: [{ atOrAbove: "0", credit: "", fixed: true }],
        perScopeCap: "",
        sourceClause: "FIXTURE clause alpha",
      },
    ],
    updatedBy: "ada",
    expectedVersion,
  };
}

describe("contract terms form", () => {
  let root: Root | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = undefined;
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  async function mount(initial: ContractFormState, handlers: { onSaved?: () => void; onReload?: () => void } = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <TermsForm
          partner="roblox"
          partnerName="Roblox"
          initial={initial}
          onSaved={handlers.onSaved}
          onReload={handlers.onReload}
        />,
      );
    });
    return container;
  }

  it("shows the loader's target rule beside the field as the value is typed", async () => {
    const container = await mount(emptyContractForm());
    const input = container.querySelector("#target-scope-1");
    expect(input).toBeInstanceOf(HTMLInputElement);
    await typeInto(input as HTMLInputElement, "200");

    const field = container.querySelector('[data-field="scopes.scope-1.target"]');
    expect(field?.textContent).toMatch(/0 to 100/);
    expect(field?.querySelector("[role='alert']")).not.toBeNull();
  });

  it("marks the effective-to field as optional in its label", async () => {
    const container = await mount(emptyContractForm());
    const label = container.querySelector('label[for="effective-to"]');

    expect(label?.textContent).toBe("Effective to (Optional)");
    expect(container.textContent).not.toContain("Effective to is optional.");
  });

  it("warns on an empty source clause and still allows a draft save", async () => {
    const form = readyForm();
    const scope = form.scopes[0];
    if (scope === undefined) {
      throw new Error("expected a scope");
    }
    form.scopes = [{ ...scope, sourceClause: "" }];
    const fetchMock = mockFetch(() => jsonResponse({ kind: "saved", version: 1 }, 200));
    const container = await mount(form);

    const warning = container.querySelector('[data-field="scopes.payments.sourceClause"] p');
    expect(warning?.textContent).toMatch(/No source clause/);
    expect(warning?.getAttribute("role")).not.toBe("alert");

    await clickButton(container, "Save draft");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("explains what belongs in the source clause field", async () => {
    const container = await mount(readyForm());
    const field = container.querySelector('[data-field="scopes.payments.sourceClause"]');
    const tooltip = field?.querySelector('[role="tooltip"]');

    expect(field?.textContent).toContain("Source clause?");
    expect(tooltip?.textContent).toContain(
      "Enter the contract section or clause reference that supports this scope’s coverage, target, and penalty figures.",
    );
  });

  it("names the partner before activation, and sends contract_bound only after confirmation", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ kind: "saved", version: 1 }, 200));
    const container = await mount(readyForm(null));

    await clickButton(container, "Activate");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Activate contract terms for Roblox? This starts scoring.");

    await clickButton(container, "Activate");
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = sentBody(fetchMock) as { lifecycle: string; expectedVersion: number | null };
    expect(body.lifecycle).toBe("contract_bound");
    expect(body.expectedVersion).toBeNull();
  });

  it("shows a conflict when a save is refused, and offers to reload", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ kind: "conflict" }, 409));
    const onReload = vi.fn();
    const container = await mount(readyForm(4), { onReload });

    await clickButton(container, "Save draft");
    expect(container.textContent).toContain("Someone else changed these terms.");
    const body = sentBody(fetchMock) as { expectedVersion: number };
    expect(body.expectedVersion).toBe(4);

    await clickButton(container, "Reload");
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("reveals a searchable registry service picker and reports the selection", async () => {
    const form = readyForm();
    const scope = form.scopes[0];
    if (scope === undefined) {
      throw new Error("expected a scope");
    }
    form.scopes = [{ ...scope, kind: "", services: [] }];
    const container = await mount(form);

    await clickButton(container, "Specific services");
    const search = container.querySelector("#service-search-payments");
    expect(search).toBeInstanceOf(HTMLInputElement);
    await typeInto(search as HTMLInputElement, "Payments");

    expect(container.textContent).toContain("Payments");
    expect(container.textContent).not.toContain("ChatPlatform");
    expect(container.textContent).toContain("0 services selected");

    await clickLabel(container, "Payments");
    expect(container.textContent).toContain("1 service selected");
  });

  it("reveals tier entry from the penalty choice", async () => {
    const container = await mount(readyForm());

    await clickButton(container, "Enter penalty tiers");

    expect(container.textContent).toContain("Availability bands");
    expect(container.textContent).toContain("Add band");
  });

  it("reports beside the actions when required fields prevent a draft save", async () => {
    const container = await mount(emptyContractForm());

    await clickButton(container, "Save draft");

    const summary = container.querySelector('[data-save-errors][role="alert"]');
    expect(summary?.textContent).toMatch(/draft was not saved/i);
    expect(summary?.textContent).toMatch(/required fields above/i);
  });

  it("shows penalty thresholds as complete availability bands", async () => {
    const form = readyForm();
    const scope = form.scopes[0];
    if (scope === undefined) {
      throw new Error("expected a scope");
    }
    form.scopes = [
      {
        ...scope,
        penaltyKind: "tiers",
        tiers: [
          { atOrAbove: "99.9", credit: "0", fixed: false },
          { atOrAbove: "98.8", credit: "6.67", fixed: false },
          { atOrAbove: "98.4", credit: "13.33", fixed: false },
          { atOrAbove: "0", credit: "13.33", fixed: true },
        ],
      },
    ];
    const container = await mount(form);

    expect(container.textContent).toContain("99.9% and above");
    expect(container.textContent).toContain("98.8% to below 99.9%");
    expect(container.textContent).toContain("98.4% to below 98.8%");
    expect(container.textContent).toContain("Below 98.4%");
  });

  it("saves optional scope and contract credit caps", async () => {
    const form = readyForm();
    const scope = form.scopes[0];
    if (scope === undefined) {
      throw new Error("expected a scope");
    }
    form.scopes = [
      {
        ...scope,
        penaltyKind: "tiers",
        tiers: [
          { atOrAbove: "99.9", credit: "0", fixed: false },
          { atOrAbove: "0", credit: "13.33", fixed: true },
        ],
      },
    ];
    const fetchMock = mockFetch(() => jsonResponse({ kind: "saved", version: 1 }, 200));
    const container = await mount(form);

    await typeInto(container.querySelector("#cap-payments") as HTMLInputElement, "13.33");
    await typeInto(container.querySelector("#aggregate-cap") as HTMLInputElement, "20");
    await clickButton(container, "Save draft");

    const body = sentBody(fetchMock) as {
      terms: { contractAggregateCap: number; scopes: { penalty: { perScopeCap: number } }[] };
    };
    expect(body.terms.contractAggregateCap).toBe(20);
    expect(body.terms.scopes[0]?.penalty.perScopeCap).toBe(13.33);
  });
});

function mockFetch(respond: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(respond(input, init)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBody(fetchMock: ReturnType<typeof mockFetch>): unknown {
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body));
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function clickButton(container: ParentNode, text: string) {
  const button = [...container.querySelectorAll("button")].find((node) => node.textContent === text);
  if (button === undefined) {
    throw new Error(`No button named ${text}`);
  }
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickLabel(container: ParentNode, text: string) {
  const label = [...container.querySelectorAll("label")].find((node) => node.textContent?.trim() === text);
  if (label === undefined) {
    throw new Error(`No label named ${text}`);
  }
  await act(async () => {
    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
