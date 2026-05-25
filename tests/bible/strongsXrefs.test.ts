import { afterEach, describe, expect, it } from "vitest";
import { formatRef } from "@/lib/bible/parseRef";
import { resetStrongsConcordanceCache } from "@/lib/bible/strongsConcordance";
import { lookupXRefs } from "@/lib/bible/xrefs";
import {
  collectStrongsXRefs,
  lookupStrongsXRefs,
  resetStrongsXrefsCache,
} from "@/lib/bible/strongsXrefs";

describe("collectStrongsXRefs", () => {
  afterEach(() => {
    resetStrongsConcordanceCache();
    resetStrongsXrefsCache();
  });
  it("matches lookupXRefs for a single occurrence verse", () => {
    const verses = [{ book: "Jhn", chapter: 3, verse: 16 }];
    const collected = collectStrongsXRefs(verses);
    const direct = lookupXRefs({
      book: "Jhn",
      chapter: 3,
      verseStart: 16,
    });
    expect(collected.length).toBe(direct.length);
    expect(collected.map((x) => x.toLabel).sort()).toEqual(
      direct.map((h) => formatRef(h.to)).sort(),
    );
  });

  it("de-duplicates the same destination from multiple source verses", () => {
    const verses = [
      { book: "Jhn", chapter: 3, verse: 16 },
      { book: "Jhn", chapter: 3, verse: 17 },
    ];
    const collected = collectStrongsXRefs(verses);
    const labels = collected.map((x) => x.toLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("returns empty for verses with no curated xrefs", () => {
    expect(
      collectStrongsXRefs([{ book: "Phm", chapter: 1, verse: 1 }]),
    ).toEqual([]);
  });
});

describe("lookupStrongsXRefs", () => {
  afterEach(() => {
    resetStrongsConcordanceCache();
    resetStrongsXrefsCache();
  });

  it("includes John 3:16 xrefs for G2316", async () => {
    const hit = await lookupStrongsXRefs("G2316");
    expect(hit).not.toBeNull();
    const jhn316 = hit!.xrefs.find((x) => x.fromVerseLabel === "John 3:16");
    expect(jhn316).toBeDefined();
    expect(hit!.count).toBeGreaterThanOrEqual(jhn316 ? 1 : 0);
  });
});
