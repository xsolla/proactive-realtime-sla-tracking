import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/internal/alerts/run/route";

const originalSecret = process.env.INTERNAL_SHARED_SECRET;
const originalDatabase = process.env.DATABASE_URL;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.INTERNAL_SHARED_SECRET;
  } else {
    process.env.INTERNAL_SHARED_SECRET = originalSecret;
  }
  if (originalDatabase === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabase;
  }
});

function post(secret?: string, body?: string): Promise<Response> {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set("x-internal-secret", secret);
  }
  return POST(
    new Request("http://localhost/api/internal/alerts/run", {
      method: "POST",
      headers,
      body,
    }),
  );
}

describe("POST /api/internal/alerts/run", () => {
  it("rejects a missing or wrong secret before evaluating", async () => {
    process.env.INTERNAL_SHARED_SECRET = "scheduled-run";

    const missing = await post();
    const wrong = await post("other-secret");

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });

  it("reports a feed failure instead of a zero-alert success", async () => {
    process.env.INTERNAL_SHARED_SECRET = "scheduled-run";
    delete process.env.DATABASE_URL;

    const accepted = await post("scheduled-run", JSON.stringify({ dryRun: true }));
    const body = (await accepted.json()) as {
      dryRun: boolean;
      scopesEvaluated: number;
      alertsSent: number;
      errors: string[];
    };

    expect(accepted.status).toBe(500);
    expect(accepted.headers.get("cache-control")).toBe("no-store");
    expect(body.dryRun).toBe(true);
    expect(body.scopesEvaluated).toBe(0);
    expect(body.alertsSent).toBe(0);
    expect(body.errors[0]).toMatch(/^Could not evaluate:/);
  });

  it("rejects a body that is not JSON", async () => {
    process.env.INTERNAL_SHARED_SECRET = "scheduled-run";

    const response = await post("scheduled-run", "{");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: string[] };
    expect(body.errors).toEqual(["Request body must be JSON."]);
  });
});
