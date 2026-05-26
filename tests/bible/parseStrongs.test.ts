import { describe, expect, it } from "vitest";
import {
  classifyStrongsSearchQuery,
  isValidStrongsNumber,
  parseStrongsQuery,
} from "@/lib/bible/parseStrongs";

describe("parseStrongsQuery", () => {
  it("normalizes letter + digits with optional spacing", () => {
    expect(parseStrongsQuery("g2316")).toBe("G2316");
    expect(parseStrongsQuery("G 2316")).toBe("G2316");
    expect(parseStrongsQuery("h7225")).toBe("H7225");
  });

  it("accepts already-canonical values", () => {
    expect(parseStrongsQuery("G3056")).toBe("G3056");
  });

  it("rejects non-Strong's input", () => {
    expect(parseStrongsQuery("god")).toBeNull();
    expect(parseStrongsQuery("2316")).toBeNull();
    expect(parseStrongsQuery("")).toBeNull();
  });
});

describe("isValidStrongsNumber", () => {
  it("matches G/H + digits only", () => {
    expect(isValidStrongsNumber("G1")).toBe(true);
    expect(isValidStrongsNumber("H7225")).toBe(true);
    expect(isValidStrongsNumber("g1")).toBe(false);
  });
});

describe("classifyStrongsSearchQuery", () => {
  it("prefers Strong's numbers over word interpretation", () => {
    expect(classifyStrongsSearchQuery("g2316")).toEqual({
      kind: "strong",
      strong: "G2316",
    });
  });

  it("treats English words as dictionary lookups", () => {
    expect(classifyStrongsSearchQuery("god")).toEqual({
      kind: "word",
      word: "god",
    });
    expect(classifyStrongsSearchQuery("  love  ")).toEqual({
      kind: "word",
      word: "love",
    });
  });

  it("rejects bare digits and empty input", () => {
    expect(classifyStrongsSearchQuery("2316")).toBeNull();
    expect(classifyStrongsSearchQuery("")).toBeNull();
    expect(classifyStrongsSearchQuery("   ")).toBeNull();
  });
});
