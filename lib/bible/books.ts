// Canonical Bible book metadata used to render the proportional BooksLane.
//
// Order:
//   Old Testament: TaNaK — Torah, Nevi'im (Former + Latter + The Twelve), Ketuvim
//   New Testament: traditional order (Gospels, Acts, Paulines, General, Revelation)
//
// Word counts use the ORIGINAL languages, not English translations:
//   - Old Testament:  Hebrew Masoretic Text (incl. Aramaic portions in Daniel/Ezra)
//                     Source: torahcalc.com / mechon-mamre.org. Total: 305,411.
//   - New Testament:  Greek NA28 critical text.
//                     Source: catholic-resources.org/Bible/NT-Statistics-Greek.htm
//                     (Felix Just, S.J., Ph.D.). Total: 138,020.
//   - Whole Bible total:  443,431 words.
//
// The BooksLane renders each book with width = book.words / sectionWords(b.section)
// inside a section element whose width is sectionWords(section) / TOTAL_BIBLE_WORDS,
// so each book ends up at exactly book.words / TOTAL_BIBLE_WORDS of the viewport.

export type Testament = "OT" | "NT";

export type TanakhSection =
  | "Torah"
  | "Nevi'im"
  | "Ketuvim"
  | "Gospels"
  | "Acts"
  | "Pauline"
  | "General"
  | "Revelation";

export interface BibleBook {
  /** Short canonical id, e.g. "Gen", "1Cor", "Rev". Stable, used in refs. */
  id: string;
  /** Display name. */
  name: string;
  /** Common abbreviated display name for narrow segments. */
  abbr: string;
  testament: Testament;
  section: TanakhSection;
  /** 1-based order within the full canon as we render it (TaNaK then NT). */
  order: number;
  /** Chapter count. */
  chapters: number;
  /** Word count in the ORIGINAL language (Hebrew/Aramaic for OT, Greek for NT). */
  words: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // ── Torah (Hebrew Masoretic) ────────────────────────────────────────────
  { id: "Gen",  name: "Genesis",      abbr: "Gen",  testament: "OT", section: "Torah",   order:  1, chapters: 50, words: 20612 },
  { id: "Exo",  name: "Exodus",       abbr: "Exo",  testament: "OT", section: "Torah",   order:  2, chapters: 40, words: 16713 },
  { id: "Lev",  name: "Leviticus",    abbr: "Lev",  testament: "OT", section: "Torah",   order:  3, chapters: 27, words: 11950 },
  { id: "Num",  name: "Numbers",      abbr: "Num",  testament: "OT", section: "Torah",   order:  4, chapters: 36, words: 16408 },
  { id: "Deu",  name: "Deuteronomy",  abbr: "Deu",  testament: "OT", section: "Torah",   order:  5, chapters: 34, words: 14294 },

  // ── Nevi'im — Former Prophets (Hebrew) ──────────────────────────────────
  { id: "Jos",  name: "Joshua",       abbr: "Jos",  testament: "OT", section: "Nevi'im", order:  6, chapters: 24, words: 10031 },
  { id: "Jdg",  name: "Judges",       abbr: "Jdg",  testament: "OT", section: "Nevi'im", order:  7, chapters: 21, words:  9885 },
  { id: "1Sa",  name: "1 Samuel",     abbr: "1Sa",  testament: "OT", section: "Nevi'im", order:  8, chapters: 31, words: 13261 },
  { id: "2Sa",  name: "2 Samuel",     abbr: "2Sa",  testament: "OT", section: "Nevi'im", order:  9, chapters: 24, words: 11033 },
  { id: "1Ki",  name: "1 Kings",      abbr: "1Ki",  testament: "OT", section: "Nevi'im", order: 10, chapters: 22, words: 13140 },
  { id: "2Ki",  name: "2 Kings",      abbr: "2Ki",  testament: "OT", section: "Nevi'im", order: 11, chapters: 25, words: 12245 },

  // ── Nevi'im — Latter Prophets (Major) (Hebrew) ──────────────────────────
  { id: "Isa",  name: "Isaiah",       abbr: "Isa",  testament: "OT", section: "Nevi'im", order: 12, chapters: 66, words: 16925 },
  { id: "Jer",  name: "Jeremiah",     abbr: "Jer",  testament: "OT", section: "Nevi'im", order: 13, chapters: 52, words: 21831 },
  { id: "Eze",  name: "Ezekiel",      abbr: "Eze",  testament: "OT", section: "Nevi'im", order: 14, chapters: 48, words: 18730 },

  // ── Nevi'im — The Twelve (Minor Prophets) (Hebrew) ──────────────────────
  { id: "Hos",  name: "Hosea",        abbr: "Hos",  testament: "OT", section: "Nevi'im", order: 15, chapters: 14, words:  2381 },
  // Joel: 3 chapters in the KJV / Christian numbering used throughout the
  // app (the Bolls KJV API and our verse pickers); 4 chapters in the BHS
  // Hebrew Masoretic numbering. We display in TaNaK *order* but adopt the
  // KJV chapter division so verse references resolve unambiguously.
  { id: "Joe",  name: "Joel",         abbr: "Joe",  testament: "OT", section: "Nevi'im", order: 16, chapters:  3, words:   957 },
  { id: "Amo",  name: "Amos",         abbr: "Amo",  testament: "OT", section: "Nevi'im", order: 17, chapters:  9, words:  2042 },
  { id: "Oba",  name: "Obadiah",      abbr: "Oba",  testament: "OT", section: "Nevi'im", order: 18, chapters:  1, words:   291 },
  { id: "Jon",  name: "Jonah",        abbr: "Jon",  testament: "OT", section: "Nevi'im", order: 19, chapters:  4, words:   688 },
  { id: "Mic",  name: "Micah",        abbr: "Mic",  testament: "OT", section: "Nevi'im", order: 20, chapters:  7, words:  1396 },
  { id: "Nah",  name: "Nahum",        abbr: "Nah",  testament: "OT", section: "Nevi'im", order: 21, chapters:  3, words:   558 },
  { id: "Hab",  name: "Habakkuk",     abbr: "Hab",  testament: "OT", section: "Nevi'im", order: 22, chapters:  3, words:   671 },
  { id: "Zep",  name: "Zephaniah",    abbr: "Zep",  testament: "OT", section: "Nevi'im", order: 23, chapters:  3, words:   767 },
  { id: "Hag",  name: "Haggai",       abbr: "Hag",  testament: "OT", section: "Nevi'im", order: 24, chapters:  2, words:   600 },
  { id: "Zec",  name: "Zechariah",    abbr: "Zec",  testament: "OT", section: "Nevi'im", order: 25, chapters: 14, words:  3126 },
  { id: "Mal",  name: "Malachi",      abbr: "Mal",  testament: "OT", section: "Nevi'im", order: 26, chapters:  4, words:   876 },

  // ── Ketuvim (Hebrew) ────────────────────────────────────────────────────
  { id: "Psa",  name: "Psalms",          abbr: "Psa", testament: "OT", section: "Ketuvim", order: 27, chapters: 150, words: 19583 },
  { id: "Pro",  name: "Proverbs",        abbr: "Pro", testament: "OT", section: "Ketuvim", order: 28, chapters:  31, words:  6915 },
  { id: "Job",  name: "Job",             abbr: "Job", testament: "OT", section: "Ketuvim", order: 29, chapters:  42, words:  8340 },
  { id: "Sng",  name: "Song of Songs",   abbr: "Sng", testament: "OT", section: "Ketuvim", order: 30, chapters:   8, words:  1250 },
  { id: "Rut",  name: "Ruth",            abbr: "Rut", testament: "OT", section: "Ketuvim", order: 31, chapters:   4, words:  1294 },
  { id: "Lam",  name: "Lamentations",    abbr: "Lam", testament: "OT", section: "Ketuvim", order: 32, chapters:   5, words:  1542 },
  { id: "Ecc",  name: "Ecclesiastes",    abbr: "Ecc", testament: "OT", section: "Ketuvim", order: 33, chapters:  12, words:  2987 },
  { id: "Est",  name: "Esther",          abbr: "Est", testament: "OT", section: "Ketuvim", order: 34, chapters:  10, words:  3045 },
  { id: "Dan",  name: "Daniel",          abbr: "Dan", testament: "OT", section: "Ketuvim", order: 35, chapters:  12, words:  5923 },
  { id: "Ezr",  name: "Ezra",            abbr: "Ezr", testament: "OT", section: "Ketuvim", order: 36, chapters:  10, words:  3754 },
  { id: "Neh",  name: "Nehemiah",        abbr: "Neh", testament: "OT", section: "Ketuvim", order: 37, chapters:  13, words:  5312 },
  { id: "1Ch",  name: "1 Chronicles",    abbr: "1Ch", testament: "OT", section: "Ketuvim", order: 38, chapters:  29, words: 10740 },
  { id: "2Ch",  name: "2 Chronicles",    abbr: "2Ch", testament: "OT", section: "Ketuvim", order: 39, chapters:  36, words: 13315 },

  // ── New Testament — Gospels (Greek NA28) ────────────────────────────────
  { id: "Mat",  name: "Matthew",         abbr: "Mat", testament: "NT", section: "Gospels",    order: 40, chapters: 28, words: 18345 },
  { id: "Mrk",  name: "Mark",            abbr: "Mrk", testament: "NT", section: "Gospels",    order: 41, chapters: 16, words: 11304 },
  { id: "Luk",  name: "Luke",            abbr: "Luk", testament: "NT", section: "Gospels",    order: 42, chapters: 24, words: 19482 },
  { id: "Jhn",  name: "John",            abbr: "Jhn", testament: "NT", section: "Gospels",    order: 43, chapters: 21, words: 15635 },

  // ── New Testament — Acts (Greek NA28) ───────────────────────────────────
  { id: "Act",  name: "Acts",            abbr: "Act", testament: "NT", section: "Acts",       order: 44, chapters: 28, words: 18451 },

  // ── New Testament — Pauline Epistles (Greek NA28) ───────────────────────
  { id: "Rom",  name: "Romans",          abbr: "Rom",  testament: "NT", section: "Pauline",    order: 45, chapters: 16, words:  7111 },
  { id: "1Co",  name: "1 Corinthians",   abbr: "1Co",  testament: "NT", section: "Pauline",    order: 46, chapters: 16, words:  6829 },
  { id: "2Co",  name: "2 Corinthians",   abbr: "2Co",  testament: "NT", section: "Pauline",    order: 47, chapters: 13, words:  4477 },
  { id: "Gal",  name: "Galatians",       abbr: "Gal",  testament: "NT", section: "Pauline",    order: 48, chapters:  6, words:  2230 },
  { id: "Eph",  name: "Ephesians",       abbr: "Eph",  testament: "NT", section: "Pauline",    order: 49, chapters:  6, words:  2422 },
  { id: "Php",  name: "Philippians",     abbr: "Php",  testament: "NT", section: "Pauline",    order: 50, chapters:  4, words:  1629 },
  { id: "Col",  name: "Colossians",      abbr: "Col",  testament: "NT", section: "Pauline",    order: 51, chapters:  4, words:  1582 },
  { id: "1Th",  name: "1 Thessalonians", abbr: "1Th",  testament: "NT", section: "Pauline",    order: 52, chapters:  5, words:  1481 },
  { id: "2Th",  name: "2 Thessalonians", abbr: "2Th",  testament: "NT", section: "Pauline",    order: 53, chapters:  3, words:   823 },
  { id: "1Ti",  name: "1 Timothy",       abbr: "1Ti",  testament: "NT", section: "Pauline",    order: 54, chapters:  6, words:  1591 },
  { id: "2Ti",  name: "2 Timothy",       abbr: "2Ti",  testament: "NT", section: "Pauline",    order: 55, chapters:  4, words:  1238 },
  { id: "Tit",  name: "Titus",           abbr: "Tit",  testament: "NT", section: "Pauline",    order: 56, chapters:  3, words:   659 },
  { id: "Phm",  name: "Philemon",        abbr: "Phm",  testament: "NT", section: "Pauline",    order: 57, chapters:  1, words:   335 },

  // ── New Testament — General Epistles (Greek NA28) ───────────────────────
  { id: "Heb",  name: "Hebrews",         abbr: "Heb",  testament: "NT", section: "General",    order: 58, chapters: 13, words:  4953 },
  { id: "Jas",  name: "James",           abbr: "Jas",  testament: "NT", section: "General",    order: 59, chapters:  5, words:  1742 },
  { id: "1Pe",  name: "1 Peter",         abbr: "1Pe",  testament: "NT", section: "General",    order: 60, chapters:  5, words:  1684 },
  { id: "2Pe",  name: "2 Peter",         abbr: "2Pe",  testament: "NT", section: "General",    order: 61, chapters:  3, words:  1099 },
  { id: "1Jn",  name: "1 John",          abbr: "1Jn",  testament: "NT", section: "General",    order: 62, chapters:  5, words:  2141 },
  { id: "2Jn",  name: "2 John",          abbr: "2Jn",  testament: "NT", section: "General",    order: 63, chapters:  1, words:   245 },
  { id: "3Jn",  name: "3 John",          abbr: "3Jn",  testament: "NT", section: "General",    order: 64, chapters:  1, words:   219 },
  { id: "Jud",  name: "Jude",            abbr: "Jud",  testament: "NT", section: "General",    order: 65, chapters:  1, words:   461 },

  // ── New Testament — Revelation (Greek NA28) ─────────────────────────────
  { id: "Rev",  name: "Revelation",      abbr: "Rev",  testament: "NT", section: "Revelation", order: 66, chapters: 22, words:  9852 },
];

export const TOTAL_BIBLE_WORDS: number = BIBLE_BOOKS.reduce(
  (sum, b) => sum + b.words,
  0,
);

export function bookById(id: string): BibleBook | undefined {
  return BIBLE_BOOKS.find((b) => b.id === id);
}

/** Sectional groupings for visual headers below the BooksLane segments. */
export const SECTION_ORDER: TanakhSection[] = [
  "Torah",
  "Nevi'im",
  "Ketuvim",
  "Gospels",
  "Acts",
  "Pauline",
  "General",
  "Revelation",
];

const SECTION_WORDS_CACHE: Partial<Record<TanakhSection, number>> = {};

export function sectionWords(section: TanakhSection): number {
  if (SECTION_WORDS_CACHE[section] === undefined) {
    SECTION_WORDS_CACHE[section] = BIBLE_BOOKS
      .filter((b) => b.section === section)
      .reduce((sum, b) => sum + b.words, 0);
  }
  return SECTION_WORDS_CACHE[section]!;
}
