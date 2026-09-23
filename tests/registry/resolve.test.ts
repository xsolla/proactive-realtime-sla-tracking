import { describe, expect, it } from "vitest";
import {
  PARTNERS,
  SEVERITIES,
  SERVICES,
  resolvePartner,
  resolveService,
  resolveSeverity,
} from "@/registry";

function byName(name: string) {
  return resolvePartner({ merchantId: null, name });
}

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
      expect(byName(raw), raw).toEqual({ status: "resolved", id });
    }
  });

  it("returns unresolved instead of guessing a nearby name", () => {
    for (const raw of ["Warner", "WB", "Namco", "Sco", "", "   ", "Not a partner"]) {
      expect(byName(raw), raw).toEqual({ status: "unresolved", raw });
    }
  });

  it("stores each pilot merchant id on its partner", () => {
    expect(PARTNERS.map((partner) => [partner.id, partner.merchantIds])).toEqual([
      ["scopely", [151639]],
      ["niantic", [221437]],
      ["kabam", [237137]],
      ["warner-brothers", [169548]],
      ["bandai-namco", [503608]],
      ["second-dinner", [506855]],
      ["roblox", [38519]],
      ["twitch", [13132]],
      ["mihoyo", [166973]],
      ["nexters", [60556]],
      ["netmarble", [207429]],
    ]);
  });

  it("resolves partner_id first and uses the name only when the id is absent", () => {
    expect(resolvePartner({ merchantId: 506855, name: "Kabam" })).toEqual({
      status: "resolved",
      id: "second-dinner",
    });
    expect(resolvePartner({ merchantId: null, name: "Kabam" })).toEqual({
      status: "resolved",
      id: "kabam",
    });
    expect(resolvePartner({ merchantId: 191692, name: "Scopely" })).toEqual({
      status: "unresolved",
      raw: "191692",
    });
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

describe("severity registry", () => {
  it("lists each severity once, under a stable slug", () => {
    expect(SEVERITIES.map((severity) => [severity.id, severity.displayName])).toEqual([
      ["l0", "L0 — Catastrophic"],
      ["l1", "L1 — Critical"],
      ["l2", "L2 — Major"],
    ]);
  });

  it("resolves realistic severity labels to that slug", () => {
    const variants: Array<[string, string]> = [
      ["L0 — Catastrophic", "l0"],
      ["L1 — Critical", "l1"],
      ["L2 — Major", "l2"],
      ["L1", "l1"],
      ["  l1 - critical  ", "l1"],
      ["1 Level", "l1"],
      ["0 Level", "l0"],
      ["2 Level", "l2"],
    ];

    for (const [raw, id] of variants) {
      expect(resolveSeverity(raw), raw).toEqual({ status: "resolved", id });
    }
  });

  it("returns unresolved instead of guessing a nearby severity", () => {
    for (const raw of ["Critical", "L3", "L9 — Minor", "", "   "]) {
      expect(resolveSeverity(raw), raw).toEqual({ status: "unresolved", raw });
    }
  });
});
