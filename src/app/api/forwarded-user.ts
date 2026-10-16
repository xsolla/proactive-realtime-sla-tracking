/**
 * The Okta identity the mini-app host proxy forwards as `X-Forwarded-User`.
 * The proxy strips any client-sent copy and sets it from the session, so it
 * is the only identity the backend trusts (design 2026-10-16 §2). Lowercased
 * and trimmed; null when the request did not come through the proxy.
 */
export function forwardedUser(request: Request): string | null {
  const value = request.headers.get("x-forwarded-user")?.trim().toLowerCase();
  return value === undefined || value === "" ? null : value;
}

const DEV_USER = "dev@xsolla.com";

/**
 * The identity a write is recorded under. In production a missing header
 * means the request bypassed the proxy and is refused (null). Anywhere else
 * (local dev through the Vite proxy, tests) a stand-in is used so no header
 * is needed. Exported for tests; production code calls it with no argument.
 */
export function writerIdentity(request: Request, env: Record<string, string | undefined> = process.env): string | null {
  const user = forwardedUser(request);
  if (user !== null) {
    return user;
  }
  return env.NODE_ENV === "production" ? null : DEV_USER;
}
