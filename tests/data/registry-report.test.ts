import { describe, expect, it } from "vitest";
import { classifyPartnerCoverage } from "@/data";
import { PARTNERS } from "@/registry";

describe("classifyPartnerCoverage", () => {
  it("reports unknown ids, name drift, zero coverage, and confirmed ids", () => {
    const before = PARTNERS.map((partner) => [...partner.merchantIds]);
    const report = classifyPartnerCoverage([
      { partnerId: "999", partner: "Mystery", rowCount: 2 },
      { partnerId: "506855", partner: "Second Dinner", rowCount: 3 },
      { partnerId: "506855", partner: "2nd Dinner", rowCount: 1 },
      { partnerId: "151639", partner: "Scopely", rowCount: 4 },
      { partnerId: "191692", partner: "Scopely", rowCount: 1 },
      { partnerId: null, partner: "Roblox", rowCount: 2 },
    ]);

    expect(PARTNERS.map((partner) => [...partner.merchantIds])).toEqual(before);
    expect(report.unknownIds).toEqual([
      { partnerId: "999", partner: "Mystery", rowCount: 2 },
      { partnerId: "191692", partner: "Scopely", rowCount: 1 },
    ]);
    expect(report.nameDisagreements).toEqual([
      {
        kind: "one_id_many_names",
        merchantId: 506855,
        names: ["2nd Dinner", "Second Dinner"],
        rowCount: 4,
      },
      {
        kind: "one_name_many_ids",
        partner: "Scopely",
        merchantIds: [151639, 191692],
        rowCount: 5,
      },
    ]);
    expect(report.confirmed).toEqual([
      {
        merchantId: 151639,
        partnerSlug: "scopely",
        displayName: "Scopely",
        rowCount: 4,
        names: ["Scopely"],
      },
      {
        merchantId: 506855,
        partnerSlug: "second-dinner",
        displayName: "Second Dinner",
        rowCount: 4,
        names: ["2nd Dinner", "Second Dinner"],
      },
    ]);
    expect(report.zeroCoverage.map((partner) => partner.id)).toEqual([
      "niantic",
      "kabam",
      "warner-brothers",
      "bandai-namco",
      "twitch",
      "mihoyo",
      "nexters",
      "netmarble",
    ]);
    expect(report.hasBlockingFindings).toBe(true);
  });

  it("does not treat a name-only row as an unknown id", () => {
    const report = classifyPartnerCoverage([{ partnerId: null, partner: "Nope", rowCount: 1 }]);

    expect(report.unknownIds).toEqual([]);
    expect(report.nameDisagreements).toEqual([]);
    expect(report.confirmed).toEqual([]);
    expect(report.hasBlockingFindings).toBe(false);
    expect(report.zeroCoverage).toHaveLength(PARTNERS.length);
  });
});
