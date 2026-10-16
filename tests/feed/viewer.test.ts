import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveViewer } from "@/feed/viewer";

const original = process.env.VIEWER_ROLE;

beforeEach(() => {
  process.env.VIEWER_ROLE = "technical";
});

afterEach(() => {
  if (original === undefined) {
    delete process.env.VIEWER_ROLE;
  } else {
    process.env.VIEWER_ROLE = original;
  }
});

describe("resolveViewer", () => {
  it("lets a business preference win over the env role", () => {
    expect(resolveViewer("business")).toEqual({ role: "business" });
  });

  it("lets a technical preference win over a business env role", () => {
    process.env.VIEWER_ROLE = "business";
    expect(resolveViewer("technical")).toEqual({ role: "technical" });
  });

  it("ignores a system preference and an absent preference, and falls back to the env role", () => {
    process.env.VIEWER_ROLE = "business";
    expect(resolveViewer("system")).toEqual({ role: "business" });
    expect(resolveViewer(undefined)).toEqual({ role: "business" });
    expect(resolveViewer("admin")).toEqual({ role: "business" });
    expect(resolveViewer("")).toEqual({ role: "business" });
  });

  it("throws when there is no usable preference and the env role is invalid", () => {
    process.env.VIEWER_ROLE = "nonsense";
    expect(() => resolveViewer(undefined)).toThrow("VIEWER_ROLE");
    expect(() => resolveViewer("system")).toThrow("VIEWER_ROLE");
  });

  it("does not need a valid env role when the preference is a dashboard role", () => {
    delete process.env.VIEWER_ROLE;
    expect(resolveViewer("business")).toEqual({ role: "business" });
  });
});
