import { unstable_noStore as noStore } from "next/cache";
import { loadWorkspace } from "@/app/dashboard/load";
import { alertsPage } from "@/app/dashboard/pages";
import { json, logPageRead, notFound, pageQuery, param } from "../respond";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** `window=all` lists every month; the workspace itself then uses the current window. */
export async function GET(request: Request) {
  noStore();
  logPageRead(request);
  const query = pageQuery(request);
  const requested = param(query, "window");
  const workspace = await loadWorkspace({ window: requested === "all" ? undefined : requested, view: param(query, "view"), windowPath: "/alerts" });
  const page = alertsPage(workspace, requested);
  return page === null ? notFound() : json(page);
}
