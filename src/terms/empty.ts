import type { SlaTermsProvider } from "./provider";

/** Production provider until the first reviewed contract is entered. */
export class EmptyTermsProvider implements SlaTermsProvider {
  listScopes: SlaTermsProvider["listScopes"] = async () => [];
}
