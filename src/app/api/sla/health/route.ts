import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getSlaHealth, getViewer } from "@/feed";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  noStore();
  const health = await getSlaHealth({
    asOf: new Date(),
    viewer: getViewer(),
  });
  return NextResponse.json(health, {
    headers: { "Cache-Control": "no-store" },
  });
}
