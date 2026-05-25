import { afterEach, describe, expect, it } from "vitest";
import { verseIndex } from "@/lib/bible/globalVerseIndex";
import {
  lookupStrongsOccurrences,
  resetStrongsConcordanceCache,
} from "@/lib/bible/strongsConcordance";

describe("strongsConcordance", () => {
  afterEach(() => {
    resetStrongsConcordanceCache();
  });

  it("returns null for malformed Strong's numbers", async () => {
    expect(await lookupStrongsOccurrences("2316")).toBeNull();
    expect(await lookupStrongsOccurrences("X123")).toBeNull();
  });

  it("returns John 3:16 for G2316 (God) among its occurrences", async () => {
    const hit = await lookupStrongsOccurrences("G2316");
    expect(hit).not.toBeNull();
    expect(hit!.count).toBeGreaterThan(100);
    const jhn316 = hit!.verses.find(
      (v) => v.book === "Jhn" && v.chapter === 3 && v.verse === 16,
    );
    expect(jhn316).toBeDefined();
  });

  it("returns Genesis 1:1 for H7225 (beginning)", async () => {
    const hit = await lookupStrongsOccurrences("H7225");
    expect(hit).not.toBeNull();
    expect(hit!.count).toBeGreaterThan(0);
    const gen11 = hit!.verses.find(
      (v) => v.book === "Gen" && v.chapter === 1 && v.verse === 1,
    );
    expect(gen11).toBeDefined();
  });

  it("lists verses in ascending global index (canon) order", async () => {
    const hit = await lookupStrongsOccurrences("G2316");
    expect(hit!.verses.length).toBe(hit!.count);
    let prevIdx = -1;
    for (const v of hit!.verses) {
      const idx = verseIndex(v.book, v.chapter, v.verse);
      expect(idx).not.toBeNull();
      expect(idx!).toBeGreaterThan(prevIdx);
      prevIdx = idx!;
    }
  });
});
