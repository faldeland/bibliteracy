import { describe, expect, it } from "vitest";
import { makeXMapper } from "@/lib/bible/bibleXAxis";
import { verseIndex } from "@/lib/bible/globalVerseIndex";
import { hitTestStrongsVerseDot } from "@/lib/bible/strongsVerseDotHitTest";

describe("hitTestStrongsVerseDot", () => {
  const width = 1000;
  const height = 24;
  const xOf = makeXMapper(width, "word");

  it("returns null when pointer is far from the baseline", () => {
    const gen = verseIndex("Gen", 1, 1)!;
    const jhn = verseIndex("Jhn", 3, 16)!;
    const indices = new Uint32Array([gen, jhn]);
    expect(
      hitTestStrongsVerseDot(xOf(gen), 0, width, height, indices, xOf),
    ).toBeNull();
  });

  it("picks the nearest dot along the strip", () => {
    const gen = verseIndex("Gen", 1, 1)!;
    const jhn = verseIndex("Jhn", 3, 16)!;
    const indices = new Uint32Array([gen, jhn]);
    const baseline = height - 2;
    expect(
      hitTestStrongsVerseDot(
        xOf(jhn),
        baseline,
        width,
        height,
        indices,
        xOf,
      ),
    ).toBe(jhn);
    expect(
      hitTestStrongsVerseDot(
        xOf(gen),
        baseline,
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
    const baseline = height - 2;
    expect(
      hitTestStrongsVerseDot(
        xOf(gen) + 50,
        baseline,
        width,
        height,
        indices,
        xOf,
        { hitRadiusPx: 4 },
      ),
    ).toBeNull();
  });
});
