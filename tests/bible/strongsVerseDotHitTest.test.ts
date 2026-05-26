import { describe, expect, it } from "vitest";
import { makeXMapper } from "@/lib/bible/bibleXAxis";
import { verseIndex } from "@/lib/bible/globalVerseIndex";
import {
  hitTestStrongsVerseDot,
  STRONGS_DOT_TOP_INSET,
  strongsVerseDotY,
} from "@/lib/bible/strongsVerseDotHitTest";

describe("hitTestStrongsVerseDot", () => {
  const width = 1000;
  const height = 24;
  const xOf = makeXMapper(width, "word");

  it("returns null when pointer is far from the dot row", () => {
    const gen = verseIndex("Gen", 1, 1)!;
    const jhn = verseIndex("Jhn", 3, 16)!;
    const indices = new Uint32Array([gen, jhn]);
    expect(
      hitTestStrongsVerseDot(
        xOf(gen),
        height - 2,
        width,
        height,
        indices,
        xOf,
      ),
    ).toBeNull();
  });

  it("picks the nearest dot along the strip", () => {
    const gen = verseIndex("Gen", 1, 1)!;
    const jhn = verseIndex("Jhn", 3, 16)!;
    const indices = new Uint32Array([gen, jhn]);
    expect(strongsVerseDotY(height)).toBe(STRONGS_DOT_TOP_INSET);
    expect(
      hitTestStrongsVerseDot(
        xOf(jhn),
        STRONGS_DOT_TOP_INSET,
        width,
        height,
        indices,
        xOf,
      ),
    ).toBe(jhn);
    expect(
      hitTestStrongsVerseDot(
        xOf(gen),
        STRONGS_DOT_TOP_INSET,
        width,
        height,
        indices,
        xOf,
      ),
    ).toBe(gen);
  });

  it("returns null when horizontal distance exceeds hit radius", () => {
    const gen = verseIndex("Gen", 1, 1)!;
    const indices = new Uint32Array([gen]);
    expect(
      hitTestStrongsVerseDot(
        xOf(gen) + 50,
        STRONGS_DOT_TOP_INSET,
        width,
        height,
        indices,
        xOf,
        { hitRadiusPx: 4 },
      ),
    ).toBeNull();
  });
});
