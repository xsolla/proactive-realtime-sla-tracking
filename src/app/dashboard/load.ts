import { unstable_noStore as noStore } from "next/cache";
import { getSlaFeed, getViewer, resolveDashboardWindow } from "@/feed";
import { QUERY_FAILED, VIEWER_UNCONFIGURED } from "./copy";
import {
  buildBusinessViewerDashboard,
  buildReadyDashboard,
  buildUnavailableDashboard,
  type DashboardModel,
} from "./model";

export async function loadDashboard(requestedWindow: string | undefined): Promise<DashboardModel> {
  noStore();
  const asOf = new Date();
  const resolved = resolveDashboardWindow(requestedWindow, asOf);

  let viewer;
  try {
    viewer = getViewer();
  } catch (error) {
    console.error("[sla-dashboard] viewer", error);
    return buildUnavailableDashboard({
      asOf,
      windowKey: resolved.key,
      message: VIEWER_UNCONFIGURED,
    });
  }

  if (viewer.role === "business") {
    return buildBusinessViewerDashboard({ asOf, windowKey: resolved.key });
  }

  try {
    const feed = await getSlaFeed({
      asOf,
      window: resolved.window,
      viewer,
    });
    if (feed.role === "business") {
      return buildBusinessViewerDashboard({ asOf, windowKey: resolved.key });
    }
    return buildReadyDashboard({ asOf, windowKey: resolved.key, feed });
  } catch (error) {
    console.error("[sla-dashboard] feed", error);
    return buildUnavailableDashboard({
      asOf,
      windowKey: resolved.key,
      message: QUERY_FAILED,
    });
  }
}
