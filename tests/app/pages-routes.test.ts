import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNUSABLE_REASONS } from "@/data";
import type { SlaFeed } from "@/feed";
import { businessScoredRow, scoredRow } from "../support/rows";

const mocks = vi.hoisted(() => ({
  getSlaFeed: vi.fn(),
  getSlaHealth: vi.fn(),
  listAlertState: vi.fn(),
  readContractTerms: vi.fn(),
  readContractTermsForPartner: vi.fn(),
}));

vi.mock("next/cache", () => ({ unstable_noStore: () => undefined }));
vi.mock("@/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/feed")>()),
  getSlaFeed: mocks.getSlaFeed,
  getSlaHealth: mocks.getSlaHealth,
}));
vi.mock("@/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/data")>()),
  getDatabase: () => ({}),
  listAlertState: mocks.listAlertState,
  readContractTerms: mocks.readContractTerms,
  readContractTermsForPartner: mocks.readContractTermsForPartner,
}));

const overview = await import("@/app/api/sla/pages/overview/route");
const alerts = await import("@/app/api/sla/pages/alerts/route");
const health = await import("@/app/api/sla/pages/health/route");
const partner = await import("@/app/api/sla/pages/partners/[partner]/route");
const terms = await import("@/app/api/sla/pages/partners/[partner]/terms/route");

const originalRole = process.env.VIEWER_ROLE;

const outageHealth: SlaFeed["health"] = {
  usableCount: 1,
  unusableCount: 0,
  countsByReason: Object.fromEntries(UNUSABLE_REASONS.map((reason) => [reason, 0])) as SlaFeed["health"]["countsByReason"],
  unresolvedPartnerNames: [],
  unresolvedServiceNames: [],
  partnersWithZeroAttributedRows: [],
};

function feedFor(viewer: { role: string }): SlaFeed {
  if (viewer.role === "business") {
    return { asOf: "2026-10-07T12:00:00.000Z", health: outageHealth, role: "business", rows: [businessScoredRow()], ingestion: { status: "ok", counts: { failed: 0, unresolved: 0, withoutMessage: 0 } } };
  }
  return {
    asOf: "2026-10-07T12:00:00.000Z",
    health: outageHealth,
    role: "technical",
    rows: [scoredRow()],
    ingestion: { status: "ok", counts: { failed: 0, unresolved: 0, withoutMessage: 0 }, failed: [], unresolved: [], withoutMessage: [] },
    invalidTerms: [],
  };
}

function request(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost:3000${path}`, { headers });
}

function params(partner: string) {
  return { params: Promise.resolve({ partner }) };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  process.env.VIEWER_ROLE = "technical";
  mocks.getSlaFeed.mockImplementation(async ({ viewer }: { viewer: { role: string } }) => feedFor(viewer));
  mocks.getSlaHealth.mockResolvedValue({ role: "technical", unusable: [{ pirKey: "GTO-7", partner: "Nobody", partnerId: null, affectedService: null, incidentStarted: null, rawOutageMinutes: null, reasons: ["unresolved_partner"] }] });
  mocks.listAlertState.mockResolvedValue([]);
  mocks.readContractTerms.mockResolvedValue([{ partnerSlug: "scopely", lifecycle: "contract_bound" }]);
  mocks.readContractTermsForPartner.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.values(mocks).forEach((mock) => mock.mockReset());
  if (originalRole === undefined) {
    delete process.env.VIEWER_ROLE;
  } else {
    process.env.VIEWER_ROLE = originalRole;
  }
});

describe("page routes", () => {
  it("serves the overview envelope with no-store and the requested window", async () => {
    const response = await overview.GET(request("/api/sla/pages/overview?window=2026-08"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["breadcrumb", "frame", "nav", "showWindow", "view"]);
    expect(body.frame.windowKey).toBe("2026-08");
    expect(body.frame.view).toEqual({ active: "technical" });
    expect(body.nav.partners[0].href).toBe("/partners/scopely?window=2026-08");
  });

  it("applies the view parameter, keeps engineer material out of the business overview, and logs the forwarded user", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await overview.GET(request("/api/sla/pages/overview?view=business", { "x-forwarded-user": "Someone@Xsolla.com" }));
    const body = await response.json();
    expect(mocks.getSlaFeed.mock.calls[0]?.[0].viewer).toEqual({ role: "business" });
    expect(body.frame.view).toEqual({ active: "business" });
    expect(body.nav.alerts).toBeNull();
    expect(JSON.stringify(body)).not.toContain("GTO-");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("viewer=someone@xsolla.com"));
  });

  it("serves the partner page, runs no backtest unless asked, and 404s an unknown slug", async () => {
    const response = await partner.GET(request("/api/sla/pages/partners/scopely?window=2026-09"), params("scopely"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.view.name).toBe("Scopely");
    expect(body.backtest).toBeNull();
    expect(body.frame.months[0].href).toBe("/partners/scopely?window=2026-10");

    const missing = await partner.GET(request("/api/sla/pages/partners/nobody"), params("nobody"));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the alerts page, lists every month on request, and 404s for the business view", async () => {
    const response = await alerts.GET(request("/api/sla/pages/alerts?window=all"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.view.state).toBe("ok");
    expect(body.view.filter[0]).toMatchObject({ label: "All months", selected: true });
    expect(body.frame.months[0].href).toMatch(/^\/alerts\?window=/);

    const business = await alerts.GET(request("/api/sla/pages/alerts?view=business"));
    expect(business.status).toBe(404);
    expect(business.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the health page with the unusable rows loaded, and 404s for the business view", async () => {
    const response = await health.GET(request("/api/sla/pages/health"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.showWindow).toBe(false);
    expect(body.view.unusable).toHaveLength(1);
    expect(body.view.unusable[0].pirKey).toBe("GTO-7");
    expect(mocks.getSlaHealth).toHaveBeenCalledTimes(1);

    const business = await health.GET(request("/api/sla/pages/health?view=business"));
    expect(business.status).toBe(404);
  });

  it("serves the terms page for a pilot partner, 404s an unknown partner and the business view", async () => {
    const response = await terms.GET(request("/api/sla/pages/partners/scopely/terms"), params("scopely"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.showWindow).toBe(false);
    expect(body.view).toMatchObject({ partner: "scopely", partnerName: "Scopely", row: null });
    expect(body.view.initial.expectedVersion).toBeNull();
    expect(body.view.services.length).toBeGreaterThan(0);
    expect(mocks.readContractTermsForPartner).toHaveBeenCalledWith({}, "scopely");

    const unknown = await terms.GET(request("/api/sla/pages/partners/nobody/terms"), params("nobody"));
    expect(unknown.status).toBe(404);
    expect(mocks.readContractTermsForPartner).toHaveBeenCalledTimes(1);

    const business = await terms.GET(request("/api/sla/pages/partners/scopely/terms?view=business"), params("scopely"));
    expect(business.status).toBe(404);
    expect(mocks.readContractTermsForPartner).toHaveBeenCalledTimes(1);
  });
});
