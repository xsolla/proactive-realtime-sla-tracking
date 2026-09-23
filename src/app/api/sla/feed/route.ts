import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { calendarMonthWindow, getSlaFeed, getViewer } from "@/feed";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  noStore();
  const asOf = new Date();
  const feed = await getSlaFeed({
    asOf,
    window: calendarMonthWindow(asOf),
    viewer: getViewer(),
  });
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "no-store" },
  });
}
