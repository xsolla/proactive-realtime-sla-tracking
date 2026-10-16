import { unstable_noStore as noStore } from "next/cache";
import { loadWorkspace } from "@/app/dashboard/load";
import { partnerPage } from "@/app/dashboard/pages";
import { json, logPageRead, notFound, pageQuery, param } from "../../respond";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** `backtest=1` runs the partner's historical replay inside this request, as the page did. */
export async function GET(request: Request, context: { params: Promise<{ partner: string }> }) {
  noStore();
  logPageRead(request);
  const { partner: id } = await context.params;
  const query = pageQuery(request);
  const workspace = await loadWorkspace({
    window: param(query, "window"),
    view: param(query, "view"),
    windowPath: `/partners/${id}`,
    backtestPartner: param(query, "backtest") === "1" ? id : undefined,
  });
  const page = partnerPage(workspace, id);
  return page === null ? notFound() : json(page);
}
