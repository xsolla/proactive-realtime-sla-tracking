import { unstable_noStore as noStore } from "next/cache";
import { loadWorkspace } from "@/app/dashboard/load";
import { overviewPage } from "@/app/dashboard/pages";
import { json, logPageRead, pageQuery, param } from "../respond";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  noStore();
  logPageRead(request);
  const query = pageQuery(request);
  const workspace = await loadWorkspace({ window: param(query, "window"), view: param(query, "view"), windowPath: "/" });
  return json(overviewPage(workspace));
}
