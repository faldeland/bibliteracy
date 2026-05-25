import { describe, expect, it } from "vitest";
import { verseIndex } from "@/lib/bible/globalVerseIndex";
import { collectVerseCrossRefSpokes } from "@/lib/bible/verseCrossRefSpokes";

describe("collectVerseCrossRefSpokes", () => {
  it("returns only pairs touching the active verse index", () => {
    const active = 100;
    const pairs = new Uint32Array([100, 200, 100, 300, 50, 60, 400, 500]);
    const spokes = collectVerseCrossRefSpokes(pairs, active);
    expect(spokes).toHaveLength(2);
    expect(spokes.map((s) => s.pairIdx)).toEqual([0, 2]);
    expect(spokes.every((s) => s.fromIdx === active || s.toIdx === active)).toBe(
      true,
    );
  });

  it("resolves Gen 2:15 when present in packed pairs", () => {
    const idx = verseIndex("Gen", 2, 15);
    expect(idx).not.toBeNull();
    const pairs = new Uint32Array([idx!, idx! + 50, idx! + 1, idx! + 2]);
    const spokes = collectVerseCrossRefSpokes(pairs, idx!);
    expect(spokes).toHaveLength(1);
    expect(spokes[0]!.fromRef.book).toBe("Gen");
    expect(spokes[0]!.fromRef.chapter).toBe(2);
    expect(spokes[0]!.fromRef.verse).toBe(15);
  });
});
