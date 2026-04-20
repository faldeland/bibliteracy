import { describe, expect, it } from "vitest";
import {
  BIBLE_BOOKS,
  bookById,
  SECTION_ORDER,
  sectionWords,
  TOTAL_BIBLE_WORDS,
} from "@/lib/bible/books";

describe("BIBLE_BOOKS — canon shape", () => {
  it("contains exactly 66 books", () => {
    expect(BIBLE_BOOKS.length).toBe(66);
  });

  it("has 39 OT + 27 NT books", () => {
    const ot = BIBLE_BOOKS.filter((b) => b.testament === "OT");
    const nt = BIBLE_BOOKS.filter((b) => b.testament === "NT");
    expect(ot.length).toBe(39);
    expect(nt.length).toBe(27);
  });

  it("has unique ids", () => {
    const ids = BIBLE_BOOKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique, contiguous 1..66 order numbers", () => {
    const orders = BIBLE_BOOKS.map((b) => b.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
  });

  it("books are stored already in canonical order", () => {
    for (let i = 0; i < BIBLE_BOOKS.length; i++) {
      expect(BIBLE_BOOKS[i].order).toBe(i + 1);
    }
  });

  it("every book has positive chapter count and word count", () => {
    for (const b of BIBLE_BOOKS) {
      expect(b.chapters).toBeGreaterThan(0);
      expect(b.words).toBeGreaterThan(0);
    }
  });

  it("every book belongs to a known section", () => {
    for (const b of BIBLE_BOOKS) {
      expect(SECTION_ORDER).toContain(b.section);
    }
  });

  it("OT books fall in OT sections; NT books in NT sections", () => {
    const otSections = new Set(["Torah", "Nevi'im", "Ketuvim"]);
    const ntSections = new Set([
      "Gospels",
      "Acts",
      "Pauline",
      "General",
      "Revelation",
    ]);
    for (const b of BIBLE_BOOKS) {
      if (b.testament === "OT") expect(otSections.has(b.section)).toBe(true);
      else expect(ntSections.has(b.section)).toBe(true);
    }
  });
});

describe("BIBLE_BOOKS — TaNaK section composition", () => {
  it("Torah has the five books of Moses in order", () => {
    const torah = BIBLE_BOOKS.filter((b) => b.section === "Torah");
    expect(torah.map((b) => b.id)).toEqual(["Gen", "Exo", "Lev", "Num", "Deu"]);
  });

  it("Nevi'im contains the 8 prophetic books (incl. The Twelve)", () => {
    const nev = BIBLE_BOOKS.filter((b) => b.section === "Nevi'im").map((b) => b.id);
    expect(nev).toEqual([
      // Former
      "Jos", "Jdg", "1Sa", "2Sa", "1Ki", "2Ki",
      // Latter — Major
      "Isa", "Jer", "Eze",
      // Latter — The Twelve (in TaNaK order)
      "Hos", "Joe", "Amo", "Oba", "Jon", "Mic",
      "Nah", "Hab", "Zep", "Hag", "Zec", "Mal",
    ]);
  });

  it("Ketuvim contains the writings (Sifrei Emet + Five Megillot + History)", () => {
    const ket = BIBLE_BOOKS.filter((b) => b.section === "Ketuvim").map((b) => b.id);
    expect(ket).toEqual([
      "Psa", "Pro", "Job",
      "Sng", "Rut", "Lam", "Ecc", "Est",
      "Dan", "Ezr", "Neh", "1Ch", "2Ch",
    ]);
  });

  it("NT Gospels are the four canonical Gospels in order", () => {
    const g = BIBLE_BOOKS.filter((b) => b.section === "Gospels").map((b) => b.id);
    expect(g).toEqual(["Mat", "Mrk", "Luk", "Jhn"]);
  });

  it("Pauline corpus is the 13 traditional Paulines (Hebrews not included)", () => {
    const p = BIBLE_BOOKS.filter((b) => b.section === "Pauline").map((b) => b.id);
    expect(p).toEqual([
      "Rom", "1Co", "2Co", "Gal", "Eph", "Php", "Col",
      "1Th", "2Th", "1Ti", "2Ti", "Tit", "Phm",
    ]);
  });

  it("General Epistles are exactly Heb/Jas/1-2 Pet/1-3 Jn/Jude", () => {
    const g = BIBLE_BOOKS.filter((b) => b.section === "General").map((b) => b.id);
    expect(g).toEqual([
      "Heb", "Jas", "1Pe", "2Pe", "1Jn", "2Jn", "3Jn", "Jud",
    ]);
  });
});

describe("Word totals", () => {
  it("TOTAL_BIBLE_WORDS equals sum of every book's word count", () => {
    const sum = BIBLE_BOOKS.reduce((a, b) => a + b.words, 0);
    expect(TOTAL_BIBLE_WORDS).toBe(sum);
  });

  it("sectionWords sums match per-section totals", () => {
    for (const s of SECTION_ORDER) {
      const expected = BIBLE_BOOKS
        .filter((b) => b.section === s)
        .reduce((a, b) => a + b.words, 0);
      expect(sectionWords(s)).toBe(expected);
    }
  });

  it("sum of all sections equals TOTAL_BIBLE_WORDS", () => {
    const total = SECTION_ORDER.reduce((a, s) => a + sectionWords(s), 0);
    expect(total).toBe(TOTAL_BIBLE_WORDS);
  });

  it("OT total ≈ 305,411 (Hebrew Masoretic) within 1%", () => {
    const ot = BIBLE_BOOKS
      .filter((b) => b.testament === "OT")
      .reduce((a, b) => a + b.words, 0);
    expect(ot).toBeGreaterThan(305000 - 4000);
    expect(ot).toBeLessThan(305000 + 4000);
  });

  it("NT total ≈ 138,020 (Greek NA28) within 1%", () => {
    const nt = BIBLE_BOOKS
      .filter((b) => b.testament === "NT")
      .reduce((a, b) => a + b.words, 0);
    expect(nt).toBeGreaterThan(138020 - 1500);
    expect(nt).toBeLessThan(138020 + 1500);
  });
});

describe("bookById", () => {
  it("returns each book by canonical id", () => {
    for (const b of BIBLE_BOOKS) {
      expect(bookById(b.id)).toEqual(b);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(bookById("Xyz")).toBeUndefined();
    expect(bookById("")).toBeUndefined();
  });
});
