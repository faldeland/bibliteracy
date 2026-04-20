import { describe, expect, it } from "vitest";
import { formatRef, parseRefs, parseSingleRef } from "@/lib/bible/parseRef";
import { BIBLE_BOOKS } from "@/lib/bible/books";

describe("parseSingleRef — happy paths", () => {
  it("parses 'John 3:16'", () => {
    expect(parseSingleRef("John 3:16")).toEqual({
      book: "Jhn",
      chapter: 3,
      verseStart: 16,
      verseEnd: undefined,
    });
  });

  it("parses 'John 3:16-17' with hyphen", () => {
    expect(parseSingleRef("John 3:16-17")).toEqual({
      book: "Jhn",
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    });
  });

  it("parses 'John 3:16–17' with en-dash", () => {
    expect(parseSingleRef("John 3:16–17")).toEqual({
      book: "Jhn",
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    });
  });

  it("parses 'John 3:16—17' with em-dash", () => {
    expect(parseSingleRef("John 3:16—17")).toEqual({
      book: "Jhn",
      chapter: 3,
      verseStart: 16,
      verseEnd: 17,
    });
  });

  it("parses 'John 3.16' (period separator)", () => {
    const r = parseSingleRef("John 3.16");
    expect(r).toEqual({
      book: "Jhn",
      chapter: 3,
      verseStart: 16,
      verseEnd: undefined,
    });
  });

  it("parses chapter-only references", () => {
    expect(parseSingleRef("Psalm 23")).toEqual({
      book: "Psa",
      chapter: 23,
      verseStart: undefined,
      verseEnd: undefined,
    });
  });

  it("parses numbered books with a leading digit", () => {
    expect(parseSingleRef("1 Cor 13")).toMatchObject({ book: "1Co", chapter: 13 });
    expect(parseSingleRef("2 Tim 3:16")).toMatchObject({
      book: "2Ti",
      chapter: 3,
      verseStart: 16,
    });
    expect(parseSingleRef("3 John 1")).toMatchObject({ book: "3Jn", chapter: 1 });
  });

  it("parses Roman-numeral-style 'III John' is NOT supported (ASCII only)", () => {
    // Document the boundary: the parser is intentionally ASCII-only; "I", "II",
    // "III" prefixes are aliased explicitly in the alias map but Roman numerals
    // longer than three letters with no digit are not recognized as a book
    // number here.
    expect(parseSingleRef("IV Cor 13")).toBeNull();
  });
});

describe("parseSingleRef — alias coverage", () => {
  // For every book, confirm at least three forms parse to it: the canonical
  // id, the full English name, and the abbreviation.
  it("every book parses by id, name, and abbreviation", () => {
    for (const b of BIBLE_BOOKS) {
      const targets = [b.id, b.name, b.abbr];
      for (const t of targets) {
        const r = parseSingleRef(`${t} 1`);
        expect(r, `parseSingleRef("${t} 1")`).not.toBeNull();
        expect(r!.book).toBe(b.id);
      }
    }
  });

  it("is case-insensitive and tolerates internal punctuation", () => {
    expect(parseSingleRef("genesis 1")).toMatchObject({ book: "Gen" });
    expect(parseSingleRef("GEN 1:1")).toMatchObject({ book: "Gen" });
    expect(parseSingleRef("Gn. 1")).toMatchObject({ book: "Gen" });
    expect(parseSingleRef("S.o.S. 2:1")).toMatchObject({ book: "Sng" });
  });

  it("accepts common alt-aliases for tricky books", () => {
    expect(parseSingleRef("Qoh 1")).toMatchObject({ book: "Ecc" });
    expect(parseSingleRef("Cant 2")).toMatchObject({ book: "Sng" });
    expect(parseSingleRef("Apoc 1")).toMatchObject({ book: "Rev" });
    expect(parseSingleRef("Phlm 1")).toMatchObject({ book: "Phm" });
    expect(parseSingleRef("ISam 3")).toMatchObject({ book: "1Sa" });
    expect(parseSingleRef("IIKings 5")).toMatchObject({ book: "2Ki" });
  });
});

describe("parseSingleRef — invalid inputs", () => {
  it("returns null for unknown books", () => {
    expect(parseSingleRef("Xyz 1:1")).toBeNull();
    expect(parseSingleRef("Maccabees 1")).toBeNull();
    expect(parseSingleRef("hello world")).toBeNull();
  });

  it("returns null for missing chapter", () => {
    expect(parseSingleRef("John")).toBeNull();
    expect(parseSingleRef("Genesis")).toBeNull();
  });

  it("returns null for chapter out of range", () => {
    expect(parseSingleRef("Genesis 51")).toBeNull(); // Gen has 50
    expect(parseSingleRef("Jude 2")).toBeNull(); // Jude has 1
    expect(parseSingleRef("Psalm 0")).toBeNull();
    expect(parseSingleRef("Psalm 200")).toBeNull();
  });

  it("returns null for verse out of range", () => {
    // John 3 has 36 verses
    expect(parseSingleRef("John 3:99")).toBeNull();
    // Psalm 117 has 2 verses
    expect(parseSingleRef("Psalm 117:5")).toBeNull();
    // Verse 0 is invalid
    expect(parseSingleRef("John 3:0")).toBeNull();
  });

  it("returns null when verseEnd precedes verseStart", () => {
    expect(parseSingleRef("John 3:17-16")).toBeNull();
  });

  it("accepts boundary verses (the last verse of a chapter)", () => {
    expect(parseSingleRef("Psalm 117:2")).toMatchObject({
      book: "Psa",
      chapter: 117,
      verseStart: 2,
    });
    expect(parseSingleRef("Psalm 119:176")).toMatchObject({
      book: "Psa",
      chapter: 119,
      verseStart: 176,
    });
  });

  it("returns null for empty / whitespace input", () => {
    expect(parseSingleRef("")).toBeNull();
    expect(parseSingleRef("   ")).toBeNull();
  });
});

describe("parseRefs — multi-ref strings", () => {
  it("returns empty for empty input", () => {
    expect(parseRefs("")).toEqual([]);
    expect(parseRefs("   ")).toEqual([]);
  });

  it("splits on commas and semicolons", () => {
    const out = parseRefs("John 3:16; Rom 8:28, 1 Cor 13");
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ book: "Jhn", chapter: 3, verseStart: 16 });
    expect(out[1]).toMatchObject({ book: "Rom", chapter: 8, verseStart: 28 });
    expect(out[2]).toMatchObject({ book: "1Co", chapter: 13 });
  });

  it("silently skips parts that fail to parse", () => {
    const out = parseRefs("John 3:16; not-a-ref; Romans 8");
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.book)).toEqual(["Jhn", "Rom"]);
  });
});

describe("formatRef", () => {
  it("formats chapter-only refs", () => {
    expect(formatRef({ book: "Psa", chapter: 23 })).toBe("Psalms 23");
  });

  it("formats single-verse refs", () => {
    expect(formatRef({ book: "Jhn", chapter: 3, verseStart: 16 })).toBe(
      "John 3:16",
    );
  });

  it("formats verse-range refs with en-dash", () => {
    expect(
      formatRef({ book: "Jhn", chapter: 3, verseStart: 16, verseEnd: 17 }),
    ).toBe("John 3:16–17");
  });

  it("collapses verseEnd === verseStart back to a single verse", () => {
    expect(
      formatRef({ book: "Jhn", chapter: 3, verseStart: 16, verseEnd: 16 }),
    ).toBe("John 3:16");
  });

  it("falls back to the raw id if the book is unknown", () => {
    expect(formatRef({ book: "Xyz", chapter: 5 })).toBe("Xyz 5");
  });

  it("parse → format → parse roundtrip preserves data", () => {
    const samples = [
      "John 3:16",
      "John 3:16-17",
      "Psalm 23",
      "1 Corinthians 13",
      "Genesis 1:1",
      "Revelation 22:21",
    ];
    for (const s of samples) {
      const r1 = parseSingleRef(s)!;
      const r2 = parseSingleRef(formatRef(r1))!;
      expect(r2).toEqual(r1);
    }
  });
});
