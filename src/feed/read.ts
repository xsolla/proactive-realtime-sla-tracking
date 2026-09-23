import { getDatabase, loadOutages, type OutagePartition } from "@/data";
import { EmptyTermsProvider, type SlaTermsProvider } from "@/terms";
import type { FeedSources } from "./types";

export async function readPartition(sources?: FeedSources): Promise<OutagePartition> {
  if (sources?.partition !== undefined) {
    return sources.partition;
  }
  return loadOutages(getDatabase());
}

/** Empty until a reviewed contract file replaces this one line. */
export function readTerms(sources?: FeedSources): SlaTermsProvider {
  return sources?.terms ?? new EmptyTermsProvider();
}
