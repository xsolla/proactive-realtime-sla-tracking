import type { CanonicalEntry } from "./types";

/** Free-text severity labels seen on outages. Short codes and "N Level" are the same level. */
export const SEVERITIES = [
  {
    id: "l0",
    displayName: "L0 — Catastrophic",
    aliases: ["L0", "0 Level"],
  },
  {
    id: "l1",
    displayName: "L1 — Critical",
    aliases: ["L1", "1 Level"],
  },
  {
    id: "l2",
    displayName: "L2 — Major",
    aliases: ["L2", "2 Level"],
  },
] as const satisfies readonly CanonicalEntry[];

export type SeverityId = (typeof SEVERITIES)[number]["id"];
