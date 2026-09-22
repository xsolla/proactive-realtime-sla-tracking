import type { PartnerId } from "@/registry";
import type { SlaScope } from "./types";

export interface SlaTermsProvider {
  listScopes(partner: PartnerId, asOf: Date): Promise<SlaScope[]>;
}
