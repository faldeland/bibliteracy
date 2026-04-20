import { BIBLE_BOOKS, type BibleBook } from "./books";
import { verseCount } from "./versesPerChapter";
import type { BibleRef } from "@/lib/grid/types";

/**
 * Build a lookup of normalized aliases → canonical book id.
 * "Normalized" = lowercased, all non-alphanumeric stripped.
 */
const ALIAS_TO_BOOK: Map<string, BibleBook> = (() => {
  const m = new Map<string, BibleBook>();
  for (const b of BIBLE_BOOKS) {
    for (const a of aliasesFor(b)) {
      m.set(normalize(a), b);
    }
  }
  return m;
})();

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function aliasesFor(b: BibleBook): string[] {
  const base: string[] = [b.id, b.name, b.abbr];
  // Hand-rolled extra aliases for the books that everyone abbreviates
  // differently. Keep this list short and high-signal.
  const extra: Record<string, string[]> = {
    Gen: ["Ge", "Gn"],
    Exo: ["Ex", "Exod"],
    Lev: ["Lv"],
    Num: ["Nm", "Nu"],
    Deu: ["Dt", "Deut"],
    Jos: ["Jsh", "Josh"],
    Jdg: ["Jud", "Judg", "Jg"],
    "1Sa": ["1Sm", "1Sam", "ISam", "1Samuel"],
    "2Sa": ["2Sm", "2Sam", "IISam", "2Samuel"],
    "1Ki": ["1Kg", "1Kgs", "1Kings", "IKings"],
    "2Ki": ["2Kg", "2Kgs", "2Kings", "IIKings"],
    "1Ch": ["1Chr", "1Chron", "1Chronicles"],
    "2Ch": ["2Chr", "2Chron", "2Chronicles"],
    Ezr: ["Ezra"],
    Neh: ["Nehemiah"],
    Est: ["Esth", "Esther"],
    Psa: ["Ps", "Psalm", "Psalms"],
    Pro: ["Pr", "Prov", "Proverbs"],
    Ecc: ["Eccl", "Qoh", "Qoheleth", "Ecclesiastes"],
    Sng: ["Song", "SoS", "SongOfSolomon", "SongOfSongs", "Cant", "Canticles"],
    Isa: ["Is", "Isaiah"],
    Jer: ["Jr", "Jeremiah"],
    Lam: ["La", "Lamentations"],
    Eze: ["Ezk", "Ezek", "Ezekiel"],
    Dan: ["Dn", "Daniel"],
    Hos: ["Ho", "Hosea"],
    Joe: ["Jl", "Joel"],
    Amo: ["Am", "Amos"],
    Oba: ["Ob", "Obad", "Obadiah"],
    Jon: ["Jnh", "Jonah"],
    Mic: ["Mi", "Micah"],
    Nah: ["Na", "Nahum"],
    Hab: ["Hb", "Habakkuk"],
    Zep: ["Zph", "Zeph", "Zephaniah"],
    Hag: ["Hg", "Haggai"],
    Zec: ["Zch", "Zech", "Zechariah"],
    Mal: ["Ml", "Malachi"],
    Mat: ["Mt", "Matt", "Matthew"],
    Mrk: ["Mk", "Mark"],
    Luk: ["Lk", "Luke"],
    Jhn: ["Jn", "Joh", "John"],
    Act: ["Ac", "Acts"],
    Rom: ["Ro", "Rm", "Romans"],
    "1Co": ["1Cor", "1Corinthians", "ICor"],
    "2Co": ["2Cor", "2Corinthians", "IICor"],
    Gal: ["Galatians"],
    Eph: ["Ephesians"],
    Php: ["Phil", "Phl", "Philippians"],
    Col: ["Colossians"],
    "1Th": ["1Thess", "1Thessalonians"],
    "2Th": ["2Thess", "2Thessalonians"],
    "1Ti": ["1Tim", "1Timothy"],
    "2Ti": ["2Tim", "2Timothy"],
    Tit: ["Titus"],
    Phm: ["Phlm", "Philemon"],
    Heb: ["Hebrews"],
    Jas: ["Jm", "Jam", "James"],
    "1Pe": ["1Pt", "1Pet", "1Peter"],
    "2Pe": ["2Pt", "2Pet", "2Peter"],
    "1Jn": ["1Jhn", "1John"],
    "2Jn": ["2Jhn", "2John"],
    "3Jn": ["3Jhn", "3John"],
    Jud: ["Jude"],
    Rev: ["Re", "Apoc", "Apocalypse", "Revelation"],
  };
  return [...base, ...(extra[b.id] ?? [])];
}

/**
 * Parse a free-form Bible reference string into structured refs.
 * Examples:
 *   "John 3:16-17"          → [{ book:"Jhn", chapter:3, verseStart:16, verseEnd:17 }]
 *   "Psa 23; Rom 8:28"      → two refs
 *   "1 Cor 13"              → [{ book:"1Co", chapter:13 }]
 *   "Genesis 1-2"           → currently treated as chapter 1 (range across
 *                             chapters not modeled; future enhancement)
 */
export function parseRefs(input: string): BibleRef[] {
  if (!input.trim()) return [];
  const parts = input.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  const out: BibleRef[] = [];
  for (const part of parts) {
    const ref = parseSingleRef(part);
    if (ref) out.push(ref);
  }
  return out;
}

// Book group accepts an optional 1-3 (or I/II/III) prefix, then one or more
// alphabetic words separated by whitespace — so multi-word names like
// "Song of Songs" or "Song of Solomon" parse the same as "Song" or "SoS".
const REF_RE =
  /^((?:[1-3]\s?|I{1,3}\s)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)*)\s*(\d+)(?:\s*[:.\s]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/;

export function parseSingleRef(input: string): BibleRef | null {
  const m = input.trim().match(REF_RE);
  if (!m) return null;
  const book = ALIAS_TO_BOOK.get(normalize(m[1]));
  if (!book) return null;
  const chapter = Number(m[2]);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters)
    return null;

  const verseStart = m[3] ? Number(m[3]) : undefined;
  const verseEnd = m[4] ? Number(m[4]) : undefined;

  // Validate verse-in-range using the canonical KJV verses-per-chapter data.
  const maxVerse = verseCount(book.id, chapter);
  if (verseStart !== undefined) {
    if (verseStart < 1) return null;
    if (maxVerse !== null && verseStart > maxVerse) return null;
  }
  if (verseEnd !== undefined) {
    if (verseEnd < 1) return null;
    if (maxVerse !== null && verseEnd > maxVerse) return null;
    if (verseStart !== undefined && verseEnd < verseStart) return null;
  }

  return { book: book.id, chapter, verseStart, verseEnd };
}

/** Format a BibleRef back into a human-readable string. */
export function formatRef(r: BibleRef): string {
  const b = BIBLE_BOOKS.find((x) => x.id === r.book);
  const name = b?.name ?? r.book;
  let out = `${name} ${r.chapter}`;
  if (r.verseStart) {
    out += `:${r.verseStart}`;
    if (r.verseEnd && r.verseEnd !== r.verseStart) out += `–${r.verseEnd}`;
  }
  return out;
}
