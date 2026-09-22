import "./fixture-guard";
import type { PartnerId } from "@/registry";
import { FIXTURE_TERMS_FILES } from "../../tests/fixtures/terms";
import type { SlaTermsProvider } from "./provider";
import { scopesForPartner } from "./select";
import type { SlaScope } from "./types";

/**
 * Engine tests only. Importing this module throws when NODE_ENV is production.
 * Do not import it from a route, a page, or `src/terms/index.ts`.
 */
export class FixtureTermsProvider implements SlaTermsProvider {
  async listScopes(partner: PartnerId, asOf: Date): Promise<SlaScope[]> {
    return scopesForPartner(FIXTURE_TERMS_FILES, partner, asOf);
  }
}
