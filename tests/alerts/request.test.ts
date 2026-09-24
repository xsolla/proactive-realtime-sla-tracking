import { describe, expect, it } from "vitest";
import { parseAlertRunRequest } from "@/alerts";

describe("parseAlertRunRequest", () => {
  it("treats an empty body as a live run", () => {
    expect(parseAlertRunRequest("")).toEqual({ dryRun: false });
    expect(parseAlertRunRequest("   ")).toEqual({ dryRun: false });
  });

  it("reads a boolean dryRun flag", () => {
    expect(parseAlertRunRequest(JSON.stringify({ dryRun: true }))).toEqual({ dryRun: true });
    expect(parseAlertRunRequest(JSON.stringify({ dryRun: false }))).toEqual({ dryRun: false });
  });

  it("rejects a non-boolean dryRun and invalid JSON", () => {
    expect(parseAlertRunRequest("{")).toEqual({ error: "Request body must be JSON." });
    expect(parseAlertRunRequest(JSON.stringify({ dryRun: "true" }))).toEqual({
      error: "dryRun must be a boolean.",
    });
  });
});
