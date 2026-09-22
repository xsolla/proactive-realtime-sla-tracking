import { describe, expect, it } from "vitest";
import { PARTNERS, SERVICES, resolvePartner, resolveService } from "@/registry";

describe("partner registry", () => {
  it("lists each pilot partner once, under a stable slug", () => {
    expect(PARTNERS.map((partner) => [partner.id, partner.displayName])).toEqual([
      ["scopely", "Scopely"],
      ["niantic", "Niantic"],
      ["kabam", "Kabam"],
      ["warner-brothers", "Warner Brothers"],
      ["bandai-namco", "Bandai Namco"],
      ["second-dinner", "Second Dinner"],
      ["roblox", "Roblox"],
      ["twitch", "Twitch"],
      ["mihoyo", "miHoYo"],
      ["nexters", "Nexters"],
      ["netmarble", "Netmarble"],
    ]);
  });

  it("resolves realistic name variants to that slug", () => {
    const variants: Array<[string, string]> = [
      ["Scopely", "scopely"],
      ["  SCOPELY  ", "scopely"],
      ["Scopely, Inc.", "scopely"],
      ["Niantic", "niantic"],
      ["Kabam", "kabam"],
      ["Warner Brothers", "warner-brothers"],
      ["warner bros.", "warner-brothers"],
      ["  WARNER   BROS.  ", "warner-brothers"],
      ["Bandai Namco", "bandai-namco"],
      ["BANDAI NAMCO Entertainment", "bandai-namco"],
      ["Second Dinner", "second-dinner"],
      ["SecondDinner", "second-dinner"],
      ["Roblox", "roblox"],
      ["Twitch", "twitch"],
      ["miHoYo", "mihoyo"],
      ["Mihoyo", "mihoyo"],
      ["HoYoverse", "mihoyo"],
      ["Nexters", "nexters"],
      ["Netmarble", "netmarble"],
      ["Netmarble Corporation", "netmarble"],
    ];

    for (const [raw, id] of variants) {
      expect(resolvePartner(raw), raw).toEqual({ status: "resolved", id });
    }
  });

  it("returns unresolved instead of guessing a nearby name", () => {
    for (const raw of ["Warner", "WB", "Namco", "Sco", "", "   ", "Not a partner"]) {
      expect(resolvePartner(raw), raw).toEqual({ status: "unresolved", raw });
    }
  });
});

describe("service registry", () => {
  it("lists each service once, under a stable slug", () => {
    expect(SERVICES.map((service) => [service.id, service.displayName])).toEqual([
      ["80lv", "80lv"],
      ["afs", "AFS"],
      ["chat-platform", "ChatPlatform"],
      ["concourse", "Concourse"],
      ["corp-site", "CorpSite"],
      ["funding-club", "Funding Club"],
      ["gamers-platform", "GamersPlatform"],
      ["igs-bb", "IGS-BB"],
      ["infrastructure", "Infrastructure"],
      ["launcher", "Launcher"],
      ["lightstream", "Lightstream"],
      ["live-ops", "LiveOps"],
      ["login", "Login"],
      ["monetization-fronted", "Monetization Fronted"],
      ["monetization-integration", "Monetization Integration"],
      ["payments", "Payments"],
      ["publisher-account", "Publisher Account"],
      ["rainmaker", "Rainmaker"],
      ["sdk", "SDK"],
      ["shop-builder", "Shop Builder"],
      ["slemma", "Slemma"],
      ["subscriptions", "Subscriptions"],
      ["unknown", "Unknown"],
      ["user-engagement", "UserEngagement"],
      ["webshop", "Webshop"],
      ["xsolla-analytics", "Xsolla Analytics"],
      ["xsolla-id", "Xsolla ID"],
      ["xsolla-mall", "Xsolla Mall"],
      ["xsolla-partner-network", "Xsolla Partner Network"],
      ["xsolla-pay", "Xsolla Pay"],
      ["xsolla-rewards", "Xsolla Rewards"],
      ["xsolla-stack", "Xsolla Stack"],
    ]);
  });

  it("resolves realistic service name variants to that slug", () => {
    const variants: Array<[string, string]> = [
      ["80lv", "80lv"],
      ["afs", "afs"],
      ["Chat Platform", "chat-platform"],
      ["  IGS-BB  ", "igs-bb"],
      ["igs bb", "igs-bb"],
      ["login", "login"],
      ["PAYMENTS", "payments"],
      ["shop-builder", "shop-builder"],
      ["ShopBuilder", "shop-builder"],
      ["Unknown", "unknown"],
      ["Web Shop", "webshop"],
      ["xsolla id", "xsolla-id"],
      ["XsollaPay", "xsolla-pay"],
    ];

    for (const [raw, id] of variants) {
      expect(resolveService(raw), raw).toEqual({ status: "resolved", id });
    }
  });

  it("returns unresolved instead of guessing a nearby service", () => {
    for (const raw of ["Pay", "Store", "IGS", "Shop", "Pay Station", "", "   !!! "]) {
      expect(resolveService(raw), raw).toEqual({ status: "unresolved", raw });
    }
  });
});
