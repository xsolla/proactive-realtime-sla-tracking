import type { CanonicalEntry } from "./types";

/**
 * Flat catalog of services that appear on outage records.
 * Parent/child relationships are not recorded here.
 * Aliases are spacing variants of the same name, not other products.
 */
export const SERVICES = [
  { id: "80lv", displayName: "80lv", aliases: [] },
  { id: "afs", displayName: "AFS", aliases: [] },
  { id: "chat-platform", displayName: "ChatPlatform", aliases: ["Chat Platform"] },
  { id: "concourse", displayName: "Concourse", aliases: [] },
  { id: "corp-site", displayName: "CorpSite", aliases: ["Corp Site"] },
  { id: "funding-club", displayName: "Funding Club", aliases: ["FundingClub"] },
  { id: "gamers-platform", displayName: "GamersPlatform", aliases: ["Gamers Platform"] },
  { id: "igs-bb", displayName: "IGS-BB", aliases: ["IGS"] },
  { id: "infrastructure", displayName: "Infrastructure", aliases: [] },
  { id: "launcher", displayName: "Launcher", aliases: [] },
  { id: "lightstream", displayName: "Lightstream", aliases: [] },
  { id: "live-ops", displayName: "LiveOps", aliases: ["Live Ops"] },
  { id: "login", displayName: "Login", aliases: [] },
  {
    id: "monetization-fronted",
    displayName: "Monetization Fronted",
    aliases: ["MonetizationFronted"],
  },
  {
    id: "monetization-integration",
    displayName: "Monetization Integration",
    aliases: ["MonetizationIntegration"],
  },
  { id: "payments", displayName: "Payments", aliases: [] },
  { id: "publisher-account", displayName: "Publisher Account", aliases: ["PublisherAccount"] },
  { id: "rainmaker", displayName: "Rainmaker", aliases: [] },
  { id: "sdk", displayName: "SDK", aliases: [] },
  { id: "shop-builder", displayName: "Shop Builder", aliases: ["ShopBuilder"] },
  { id: "slemma", displayName: "Slemma", aliases: [] },
  { id: "subscriptions", displayName: "Subscriptions", aliases: [] },
  { id: "unknown", displayName: "Unknown", aliases: [] },
  { id: "user-engagement", displayName: "UserEngagement", aliases: ["User Engagement"] },
  { id: "webshop", displayName: "Webshop", aliases: ["Web Shop"] },
  { id: "xsolla-analytics", displayName: "Xsolla Analytics", aliases: ["XsollaAnalytics"] },
  { id: "xsolla-id", displayName: "Xsolla ID", aliases: ["XsollaID"] },
  { id: "xsolla-mall", displayName: "Xsolla Mall", aliases: ["XsollaMall"] },
  {
    id: "xsolla-partner-network",
    displayName: "Xsolla Partner Network",
    aliases: ["XsollaPartnerNetwork"],
  },
  { id: "xsolla-pay", displayName: "Xsolla Pay", aliases: ["XsollaPay"] },
  { id: "xsolla-rewards", displayName: "Xsolla Rewards", aliases: ["XsollaRewards"] },
  { id: "xsolla-stack", displayName: "Xsolla Stack", aliases: ["XsollaStack"] },
] as const satisfies readonly CanonicalEntry[];

export type ServiceId = (typeof SERVICES)[number]["id"];
