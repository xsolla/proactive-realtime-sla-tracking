import { timingSafeEqual } from "node:crypto";
import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SECRET_HEADER = "x-internal-secret";

export async function POST(request: Request) {
  noStore();
  if (!sharedSecretMatches(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { error: "Not implemented" },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}

/** Checked in this handler on every request. A private network does not replace it. */
function sharedSecretMatches(request: Request): boolean {
  const expected = process.env.INTERNAL_SHARED_SECRET;
  const provided = request.headers.get(SECRET_HEADER);
  if (!expected || provided === null) {
    return false;
  }
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
}
