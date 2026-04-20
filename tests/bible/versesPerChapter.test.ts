import { describe, expect, it } from "vitest";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import {
  chapterCount,
  TOTAL_KJV_VERSES,
  VERSES_PER_CHAPTER,
  verseCount,
} from "@/lib/bible/versesPerChapter";

// These tests are the "biblical accuracy" backstop for the entire app.
// They validate the verses-per-chapter dataset against universally agreed
// KJV totals and high-confidence reference points, then cross-check that
// the BIBLE_BOOKS metadata is consistent with the dataset.

describe("KJV verses-per-chapter dataset", () => {
  it("covers every one of the 66 canonical books", () => {
    const ids = Object.keys(VERSES_PER_CHAPTER).sort();
    expect(ids.length).toBe(66);
    const bookIds = BIBLE_BOOKS.map((b) => b.id).sort();
    expect(ids).toEqual(bookIds);
  });

  it("chapter count for each book matches BIBLE_BOOKS.chapters", () => {
    for (const b of BIBLE_BOOKS) {
      expect(chapterCount(b.id), `${b.id} chapter count`).toBe(b.chapters);
    }
  });

  it("totals exactly 31,102 verses (the canonical KJV total)", () => {
    expect(TOTAL_KJV_VERSES).toBe(31102);
  });

  it("totals 23,145 OT verses + 7,957 NT verses", () => {
    let ot = 0;
    let nt = 0;
    for (const b of BIBLE_BOOKS) {
      const sum = VERSES_PER_CHAPTER[b.id].reduce((a, c) => a + c, 0);
      if (b.testament === "OT") ot += sum;
      else nt += sum;
    }
    expect(ot).toBe(23145);
    expect(nt).toBe(7957);
  });

  it("matches well-known specific verse counts", () => {
    // The longest and shortest chapters in the Bible.
    expect(verseCount("Psa", 119)).toBe(176);
    expect(verseCount("Psa", 117)).toBe(2);

    // Crowd-favorite / often-cited chapter lengths.
    expect(verseCount("Gen", 1)).toBe(31);
    expect(verseCount("Psa", 23)).toBe(6);
    expect(verseCount("Mat", 5)).toBe(48); // Sermon on the Mount, ch. 1
    expect(verseCount("Jhn", 3)).toBe(36); // contains John 3:16
    expect(verseCount("Rom", 8)).toBe(39);
    expect(verseCount("1Co", 13)).toBe(13);
    expect(verseCount("Rev", 22)).toBe(21);

    // Boundary books.
    expect(verseCount("Oba", 1)).toBe(21);
    expect(verseCount("Phm", 1)).toBe(25);
    expect(verseCount("Jud", 1)).toBe(25);
    expect(verseCount("2Jn", 1)).toBe(13);
    expect(verseCount("3Jn", 1)).toBe(14);
  });
});

describe("verseCount / chapterCount API", () => {
  it("returns null for unknown books", () => {
    expect(verseCount("Xyz", 1)).toBeNull();
    expect(chapterCount("Xyz")).toBeNull();
  });

  it("returns null for out-of-range chapters", () => {
    expect(verseCount("Gen", 0)).toBeNull();
    expect(verseCount("Gen", 51)).toBeNull();
    expect(verseCount("Gen", 1.5)).toBeNull();
    expect(verseCount("Gen", -1)).toBeNull();
  });
});
