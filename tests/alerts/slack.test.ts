import { describe, expect, it } from "vitest";
import { postSlackMessage } from "@/alerts";

const TOKEN = "xoxb-test-token";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("postSlackMessage", () => {
  it("posts chat.postMessage and treats only ok: true as delivered", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await postSlackMessage({
      token: TOKEN,
      channel: "C-engineer",
      text: "*Scopely* is *at risk*",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({ ok: true, ts: "1" });
      },
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://slack.com/api/chat.postMessage");
    expect(calls[0]?.init.method).toBe("POST");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    const serialized = String(calls[0]?.init.body);
    expect(serialized).not.toContain(TOKEN);
    expect(JSON.parse(serialized)).toEqual({
      channel: "C-engineer",
      text: "*Scopely* is *at risk*",
    });
    expect(serialized).not.toContain("markdown_text");
  });

  it("treats HTTP 200 with ok: false as not delivered and does not retry", async () => {
    let calls = 0;
    const result = await postSlackMessage({
      token: TOKEN,
      channel: "C-engineer",
      text: "hello",
      fetch: async () => {
        calls += 1;
        return jsonResponse({ ok: false, error: "not_in_channel" });
      },
    });

    expect(calls).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not_in_channel");
      expect(result.error.toLowerCase()).toContain("invite");
    }
  });

  it("treats HTTP 200 without ok: true as not delivered", async () => {
    const result = await postSlackMessage({
      token: TOKEN,
      channel: "C-engineer",
      text: "hello",
      fetch: async () => jsonResponse({ ts: "1" }),
    });

    expect(result).toEqual({
      ok: false,
      error: "Slack returned HTTP 200 without ok: true.",
    });
  });

  it("retries HTTP 429 once, waiting on Retry-After, then accepts ok: true", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await postSlackMessage({
      token: TOKEN,
      channel: "C-engineer",
      text: "hello",
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetch: async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ ok: false, error: "ratelimited" }, 429, { "retry-after": "1" });
        }
        return jsonResponse({ ok: true });
      },
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(sleeps).toEqual([1000]);
  });

  it("caps a long Retry-After and gives up after the single retry", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await postSlackMessage({
      token: TOKEN,
      channel: "C-engineer",
      text: "hello",
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetch: async () => {
        calls += 1;
        return jsonResponse({ ok: false, error: "ratelimited" }, 429, { "retry-after": "30" });
      },
    });

    expect(calls).toBe(2);
    expect(sleeps).toEqual([2000]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("429");
    }
  });

  it("treats a timeout as not delivered", async () => {
    const result = await postSlackMessage({
      token: TOKEN,
      channel: "C-engineer",
      text: "hello",
      fetch: async () => {
        const error = new Error("The operation was aborted due to timeout");
        error.name = "TimeoutError";
        throw error;
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.toLowerCase()).toContain("timed out");
    }
  });
});
