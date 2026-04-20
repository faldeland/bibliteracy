import { describe, expect, it } from "vitest";
import { CROSS_REFERENCES } from "@/lib/bible/crossRefs";
import { crossReferenceCount, lookupXRefs } from "@/lib/bible/xrefs";
import { bookById } from "@/lib/bible/books";
import { verseCount } from "@/lib/bible/versesPerChapter";
import type { BibleRef } from "@/lib/grid/types";

// Mechanical accuracy guard: every reference in the dataset must resolve to a
// real book / real chapter / real verse range.
function assertRefIsValid(r: BibleRef, ctx: string) {
  const book = bookById(r.book);
  expect(book, `${ctx}: unknown book ${r.book}`).toBeDefined();
  expect(
    r.chapter >= 1 && r.chapter <= book!.chapters,
    `${ctx}: chapter ${r.chapter} out of range for ${r.book} (1..${book!.chapters})`,
  ).toBe(true);
  const max = verseCount(r.book, r.chapter);
  if (r.verseStart !== undefined) {
    expect(r.verseStart >= 1, `${ctx}: verseStart < 1`).toBe(true);
    if (max !== null) {
      expect(
        r.verseStart <= max,
        `${ctx}: verseStart ${r.verseStart} > ${max} for ${r.book} ${r.chapter}`,
      ).toBe(true);
    }
  }
  if (r.verseEnd !== undefined) {
    expect(r.verseEnd >= 1, `${ctx}: verseEnd < 1`).toBe(true);
    if (max !== null) {
      expect(
        r.verseEnd <= max,
        `${ctx}: verseEnd ${r.verseEnd} > ${max} for ${r.book} ${r.chapter}`,
      ).toBe(true);
    }
    if (r.verseStart !== undefined) {
      expect(
        r.verseEnd >= r.verseStart,
        `${ctx}: verseEnd ${r.verseEnd} < verseStart ${r.verseStart}`,
      ).toBe(true);
    }
  }
}

describe("CROSS_REFERENCES — accuracy", () => {
  it("contains a non-trivial number of curated references", () => {
    expect(crossReferenceCount()).toBeGreaterThanOrEqual(20);
  });

  it("every `from` reference is a valid Bible passage", () => {
    for (let i = 0; i < CROSS_REFERENCES.length; i++) {
      const x = CROSS_REFERENCES[i];
      assertRefIsValid(x.from, `CROSS_REFERENCES[${i}].from`);
    }
  });

  it("every `to` reference is a valid Bible passage", () => {
    for (let i = 0; i < CROSS_REFERENCES.length; i++) {
      const x = CROSS_REFERENCES[i];
      expect(x.to.length, `CROSS_REFERENCES[${i}].to is empty`).toBeGreaterThan(0);
      x.to.forEach((to, j) =>
        assertRefIsValid(to, `CROSS_REFERENCES[${i}].to[${j}]`),
      );
    }
  });

  it("every entry has a non-empty note", () => {
    for (const x of CROSS_REFERENCES) {
      expect(x.note.trim().length).toBeGreaterThan(0);
    }
  });

  it("no entry points back to its own source", () => {
    for (const x of CROSS_REFERENCES) {
      for (const to of x.to) {
        const sameBookChapter =
          to.book === x.from.book && to.chapter === x.from.chapter;
        const sameVerse =
          sameBookChapter &&
          (to.verseStart ?? null) === (x.from.verseStart ?? null) &&
          (to.verseEnd ?? null) === (x.from.verseEnd ?? null);
        expect(sameVerse, `${x.note}: self-reference`).toBe(false);
      }
    }
  });
});

describe("lookupXRefs", () => {
  it("returns the Isaiah 7:14 → Matthew 1:22-23 link when querying Isaiah 7:14", () => {
    const hits = lookupXRefs({ book: "Isa", chapter: 7, verseStart: 14 });
    const targets = hits.map((h) => `${h.to.book} ${h.to.chapter}`);
    expect(targets).toContain("Mat 1");
  });

  it("returns the most-quoted-OT-verse hits when querying Psalm 110:1", () => {
    const hits = lookupXRefs({ book: "Psa", chapter: 110, verseStart: 1 });
    const targetBooks = hits.map((h) => h.to.book);
    expect(targetBooks).toEqual(
      expect.arrayContaining(["Mat", "Mrk", "Luk", "Act", "Heb"]),
    );
  });

  it("returns Joel 2:28-32 → Acts 2:17-21", () => {
    const hits = lookupXRefs({ book: "Joe", chapter: 2, verseStart: 28 });
    const acts = hits.find((h) => h.to.book === "Act");
    expect(acts).toBeDefined();
    expect(acts!.to.chapter).toBe(2);
  });

  it("treats chapter-only queries as covering the whole chapter", () => {
    const verse = lookupXRefs({ book: "Psa", chapter: 23, verseStart: 1 });
    const chapter = lookupXRefs({ book: "Psa", chapter: 23 });
    // The Psalm 23 entry has no verse range, so a verse-1 query still hits it.
    expect(verse.length).toBeGreaterThan(0);
    expect(chapter.length).toBeGreaterThanOrEqual(verse.length);
  });

  it("returns an empty list for passages with no curated cross-references", () => {
    const hits = lookupXRefs({ book: "3Jn", chapter: 1, verseStart: 5 });
    expect(hits).toEqual([]);
  });

  it("results are de-duplicated and in canon order", () => {
    const hits = lookupXRefs({ book: "Psa", chapter: 110, verseStart: 1 });
    // canon order: Mat (40) < Mrk (41) < Luk (42) < Act (44) < Heb (58)
    const orderIds = hits.map((h) => h.to.book);
    const expected = [...orderIds].sort((a, b) => {
      const order: Record<string, number> = {
        Mat: 1, Mrk: 2, Luk: 3, Act: 4, Heb: 5,
      };
      return (order[a] ?? 99) - (order[b] ?? 99);
    });
    expect(orderIds).toEqual(expected);

    const seen = new Set<string>();
    for (const h of hits) {
      const k = `${h.to.book}:${h.to.chapter}:${h.to.verseStart ?? ""}`;
      expect(seen.has(k), `duplicate ${k}`).toBe(false);
      seen.add(k);
    }
  });

  it("does not return cross-references from a different chapter", () => {
    // Joel 2 has cross-refs; Joel 1 should be empty (no curated entries).
    const j1 = lookupXRefs({ book: "Joe", chapter: 1, verseStart: 1 });
    expect(j1).toEqual([]);
  });
});
