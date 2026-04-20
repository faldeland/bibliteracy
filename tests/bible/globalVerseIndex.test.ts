import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import { TOTAL_KJV_VERSES, VERSES_PER_CHAPTER } from "@/lib/bible/versesPerChapter";
import {
  TOTAL_VERSES,
  bookRange,
  verseFromIndex,
  verseIndex,
} from "@/lib/bible/globalVerseIndex";

describe("globalVerseIndex", () => {
  it("matches the canonical KJV verse total", () => {
    expect(TOTAL_VERSES).toBe(TOTAL_KJV_VERSES);
    expect(TOTAL_VERSES).toBe(31102);
  });

  it("Genesis 1:1 is index 0", () => {
    expect(verseIndex("Gen", 1, 1)).toBe(0);
  });

  it("Revelation 22:21 is the last index", () => {
    expect(verseIndex("Rev", 22, 21)).toBe(TOTAL_VERSES - 1);
  });

  it("rejects out-of-range chapter and verse", () => {
    expect(verseIndex("Gen", 0, 1)).toBeNull();
    expect(verseIndex("Gen", 1, 0)).toBeNull();
    expect(verseIndex("Gen", 51, 1)).toBeNull(); // Genesis has 50 chapters
    expect(verseIndex("Gen", 1, 32)).toBeNull(); // Gen 1 has 31 verses
    expect(verseIndex("NotABook", 1, 1)).toBeNull();
  });

  it("book ranges are contiguous and cover [0, TOTAL_VERSES)", () => {
    let cursor = 0;
    for (const b of BIBLE_BOOKS) {
      const r = bookRange(b.id);
      expect(r, b.id).not.toBeNull();
      expect(r!.start, `${b.id} start`).toBe(cursor);
      const expectedSize = VERSES_PER_CHAPTER[b.id].reduce((s, v) => s + v, 0);
      expect(r!.end - r!.start, `${b.id} size`).toBe(expectedSize);
      cursor = r!.end;
    }
    expect(cursor).toBe(TOTAL_VERSES);
  });

  it("verseFromIndex is the inverse of verseIndex", () => {
    // Spot-check a handful of well-known verses across the canon.
    const cases: Array<[string, number, number]> = [
      ["Gen", 1, 1],
      ["Gen", 50, 26],
      ["Exo", 1, 1],
      ["Psa", 23, 1],
      ["Psa", 119, 105],
      ["Isa", 53, 5],
      ["Mat", 1, 1],
      ["Jhn", 3, 16],
      ["Rom", 8, 28],
      ["Rev", 22, 21],
    ];
    for (const [book, ch, v] of cases) {
      const idx = verseIndex(book, ch, v);
      expect(idx, `${book} ${ch}:${v}`).not.toBeNull();
      expect(verseFromIndex(idx!)).toEqual({ book, chapter: ch, verse: v });
    }
  });

  it("verseFromIndex round-trips for every verse in the canon", () => {
    // Brute-force sanity: 31k iterations runs in well under a second and
    // catches any off-by-one in either direction.
    for (let i = 0; i < TOTAL_VERSES; i++) {
      const ref = verseFromIndex(i);
      expect(ref, `idx ${i}`).not.toBeNull();
      expect(verseIndex(ref!.book, ref!.chapter, ref!.verse)).toBe(i);
    }
  });

  it("rejects out-of-bounds indices", () => {
    expect(verseFromIndex(-1)).toBeNull();
    expect(verseFromIndex(TOTAL_VERSES)).toBeNull();
  });
});
