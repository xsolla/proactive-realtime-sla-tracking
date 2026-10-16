import { NextResponse } from "next/server";

/**
 * Shared by the page routes the mini-app reads. Every response is no-store
 * (main spec §8.4): a stale evaluation fails invisibly by showing plausible
 * wrong numbers.
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function notFound(): NextResponse {
  return json({ kind: "not_found" }, 404);
}

/** The page query: `window` and `view` as the mini-app sends them, plus any route-specific keys. */
export function pageQuery(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

export function param(query: URLSearchParams, name: string): string | undefined {
  const value = query.get(name);
  return value === null || value === "" ? undefined : value;
}

/**
 * The Okta identity the mini-app host proxy forwards, lowercased. Null when
 * the request did not come through the proxy (the Vite dev proxy sets it;
 * a direct call from the job or a test does not).
 */
export function forwardedUser(request: Request): string | null {
  const value = request.headers.get("x-forwarded-user")?.trim().toLowerCase();
  return value === undefined || value === "" ? null : value;
}

/** One line per page read, so who looked at what is in the service log. */
export function logPageRead(request: Request): void {
  const url = new URL(request.url);
  console.info(`[sla-dashboard] page ${url.pathname}${url.search} viewer=${forwardedUser(request) ?? "none"}`);
}
