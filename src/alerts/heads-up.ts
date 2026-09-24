import type { TechnicalRow } from "@/feed";
import { HEADS_UP_MEDIAN_MARGIN_MINUTES, HEADS_UP_MEDIAN_RATIO, HEADS_UP_MIN_MINUTES } from "./constants";

type TrackingRow = Extract<TechnicalRow, { kind: "tracking_only" }>;

export function trackingSignal(row: TrackingRow): "heads_up" | "quiet" {
  const comparison = row.comparison;
  if (comparison.kind === "insufficient_history") {
    return "quiet";
  }
  if (comparison.kind === "no_prior_downtime") {
    return row.usedMinutes > HEADS_UP_MIN_MINUTES ? "heads_up" : "quiet";
  }
  const clearsRatio = comparison.currentMinutes >= comparison.medianMinutes * HEADS_UP_MEDIAN_RATIO;
  const clearsMargin = comparison.currentMinutes - comparison.medianMinutes >= HEADS_UP_MEDIAN_MARGIN_MINUTES;
  if (comparison.versusMedian === "above" && clearsRatio && clearsMargin) {
    return "heads_up";
  }
  return "quiet";
}
