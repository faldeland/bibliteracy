import { describe, expect, it } from "vitest";
import { countVerseCrossRefs, verseHasCrossRefs } from "@/lib/bible/xrefsClient";

describe("verseHasCrossRefs", () => {
  it("returns true when a pair touches the verse index", () => {
    const pairs = new Uint32Array([10, 20, 30, 40]);
    expect(verseHasCrossRefs(pairs, 10)).toBe(true);
    expect(verseHasCrossRefs(pairs, 20)).toBe(true);
    expect(verseHasCrossRefs(pairs, 30)).toBe(true);
    expect(verseHasCrossRefs(pairs, 40)).toBe(true);
  });

  it("returns false when no pair touches the verse index", () => {
    const pairs = new Uint32Array([10, 20, 30, 40]);
    expect(verseHasCrossRefs(pairs, 99)).toBe(false);
  });

  it("returns false for an empty pair list", () => {
    expect(verseHasCrossRefs(new Uint32Array(0), 0)).toBe(false);
    expect(countVerseCrossRefs(new Uint32Array(0), 0)).toBe(0);
  });

  it("countVerseCrossRefs tallies every touching pair", () => {
    const pairs = new Uint32Array([10, 20, 10, 30, 40, 50]);
    expect(countVerseCrossRefs(pairs, 10)).toBe(2);
    expect(countVerseCrossRefs(pairs, 99)).toBe(0);
  });
});
