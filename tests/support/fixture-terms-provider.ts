import type { PartnerId } from "@/registry";
import type { SlaTermsProvider } from "@/terms";
import { scopesForPartner } from "@/terms/select";
import type { SlaScope } from "@/terms/types";
import { FIXTURE_TERMS_FILES } from "../fixtures/terms";

/** Test-only terms provider backed by invented fixture contract terms. */
export class FixtureTermsProvider implements SlaTermsProvider {
  async listScopes(partner: PartnerId, asOf: Date): Promise<SlaScope[]> {
    return scopesForPartner(FIXTURE_TERMS_FILES, partner, asOf);
  }
}
