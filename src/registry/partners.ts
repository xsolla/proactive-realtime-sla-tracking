import type { CanonicalEntry } from "./types";

export const PARTNERS = [
  {
    id: "scopely",
    displayName: "Scopely",
    aliases: ["Scopely Inc"],
  },
  {
    id: "niantic",
    displayName: "Niantic",
    aliases: ["Niantic Inc"],
  },
  {
    id: "kabam",
    displayName: "Kabam",
    aliases: ["Kabam Inc"],
  },
  {
    id: "warner-brothers",
    displayName: "Warner Brothers",
    aliases: ["Warner Bros", "Warner Bros. Games", "Warner Brothers Games"],
  },
  {
    id: "bandai-namco",
    displayName: "Bandai Namco",
    aliases: ["BANDAI NAMCO", "Bandai Namco Entertainment", "Bandai Namco Entertainment Inc"],
  },
  {
    id: "second-dinner",
    displayName: "Second Dinner",
    aliases: ["SecondDinner"],
  },
  {
    id: "roblox",
    displayName: "Roblox",
    aliases: ["Roblox Corporation"],
  },
  {
    id: "twitch",
    displayName: "Twitch",
    aliases: ["Twitch Interactive"],
  },
  {
    id: "mihoyo",
    displayName: "miHoYo",
    aliases: ["Mihoyo", "HoYoverse", "miHoYo/HoYoverse", "Cognosphere"],
  },
  {
    id: "nexters",
    displayName: "Nexters",
    aliases: ["Nexters Global"],
  },
  {
    id: "netmarble",
    displayName: "Netmarble",
    aliases: ["Netmarble Corp", "Netmarble Corporation"],
  },
] as const satisfies readonly CanonicalEntry[];

export type PartnerId = (typeof PARTNERS)[number]["id"];
