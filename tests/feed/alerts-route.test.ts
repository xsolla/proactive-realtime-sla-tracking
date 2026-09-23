import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/internal/alerts/run/route";

const original = process.env.INTERNAL_SHARED_SECRET;

afterEach(() => {
  if (original === undefined) {
    delete process.env.INTERNAL_SHARED_SECRET;
  } else {
    process.env.INTERNAL_SHARED_SECRET = original;
  }
});

function post(secret?: string): Promise<Response> {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set("x-internal-secret", secret);
  }
  return POST(
    new Request("http://localhost/api/internal/alerts/run", {
      method: "POST",
      headers,
    }),
  );
}

describe("POST /api/internal/alerts/run", () => {
  it("rejects a missing or wrong secret and returns 501 only after the secret matches", async () => {
    process.env.INTERNAL_SHARED_SECRET = "scheduled-run";

    const missing = await post();
    const wrong = await post("other-secret");
    const accepted = await post("scheduled-run");

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(accepted.status).toBe(501);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(accepted.headers.get("cache-control")).toBe("no-store");
  });
});
