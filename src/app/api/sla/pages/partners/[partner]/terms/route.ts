import { unstable_noStore as noStore } from "next/cache";
import { loadWorkspace } from "@/app/dashboard/load";
import { termsPage } from "@/app/dashboard/pages";
import { getDatabase, readContractTermsForPartner } from "@/data";
import { isPartnerId } from "@/registry";
import { json, logPageRead, notFound, pageQuery, param } from "../../../respond";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request, context: { params: Promise<{ partner: string }> }) {
  noStore();
  logPageRead(request);
  const { partner } = await context.params;
  if (!isPartnerId(partner)) {
    return notFound();
  }
  const query = pageQuery(request);
  const workspace = await loadWorkspace({ window: param(query, "window"), view: param(query, "view") });
  if (workspace.role === "business") {
    return notFound();
  }
  const row = await readContractTermsForPartner(getDatabase(), partner);
  const page = termsPage(workspace, partner, row);
  return page === null ? notFound() : json(page);
}
