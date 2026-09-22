export type CanonicalEntry<Id extends string = string> = {
  id: Id;
  displayName: string;
  aliases: readonly string[];
};

export type ResolveResult<Id extends string> =
  | { status: "resolved"; id: Id }
  | { status: "unresolved"; raw: string };
