// Server-side helpers for talking to the free, keyless bolls.life Bible API.
//
// We restrict ourselves to translations whose `text` field embeds Strong's
// number tags inline, e.g. "There was<S>2258</S> a man<S>444</S> ..." — that
// alignment is what lets us render the per-word Hebrew (OT) / Greek (NT)
// lemma row and the BDB / Thayer's word-study popover. The list of allowed
// translation slugs lives in `lib/bible/translations.ts`.
//
// We also use:
//   • BDBT dictionary — Brown-Driver-Briggs (Hebrew) + Thayer's (Greek). One
//     lookup per Strong's number returns lexeme, transliteration, pronunciation,
//     short_definition (for the inline gloss), and a full HTML definition (for
//     the hover/click word study).
//
// API docs: https://github.com/Bolls-Bible/bain/blob/master/docs/API.md
//
// Bolls book IDs follow the standard Protestant 66-book order; our own
// `BIBLE_BOOKS` list uses TaNaK ordering, so we keep an explicit map below.

import { BIBLE_BOOKS, type BibleBook } from "./books";
import {
  DEFAULT_TRANSLATION_ID,
  getTranslation,
  translationCovers,
} from "./translations";

/** Map our canonical book id → bolls.life numeric book id (1..66). */
const BOLLS_BOOK_ID: Record<string, number> = {
  // Old Testament — Christian/Protestant order
  Gen: 1, Exo: 2, Lev: 3, Num: 4, Deu: 5,
  Jos: 6, Jdg: 7, Rut: 8,
  "1Sa": 9, "2Sa": 10,
  "1Ki": 11, "2Ki": 12,
  "1Ch": 13, "2Ch": 14,
  Ezr: 15, Neh: 16, Est: 17,
  Job: 18, Psa: 19, Pro: 20, Ecc: 21, Sng: 22,
  Isa: 23, Jer: 24, Lam: 25, Eze: 26, Dan: 27,
  Hos: 28, Joe: 29, Amo: 30, Oba: 31, Jon: 32,
  Mic: 33, Nah: 34, Hab: 35, Zep: 36, Hag: 37, Zec: 38, Mal: 39,

  // New Testament
  Mat: 40, Mrk: 41, Luk: 42, Jhn: 43, Act: 44,
  Rom: 45, "1Co": 46, "2Co": 47, Gal: 48, Eph: 49, Php: 50, Col: 51,
  "1Th": 52, "2Th": 53, "1Ti": 54, "2Ti": 55, Tit: 56, Phm: 57,
  Heb: 58, Jas: 59, "1Pe": 60, "2Pe": 61,
  "1Jn": 62, "2Jn": 63, "3Jn": 64, Jud: 65, Rev: 66,
};

export function bollsIdFor(bookId: string): number | null {
  return BOLLS_BOOK_ID[bookId] ?? null;
}

export function bookForBollsId(bollsId: number): BibleBook | undefined {
  const ourId = Object.keys(BOLLS_BOOK_ID).find(
    (k) => BOLLS_BOOK_ID[k] === bollsId,
  );
  return ourId ? BIBLE_BOOKS.find((b) => b.id === ourId) : undefined;
}

// ─── Verse / chapter parsing ─────────────────────────────────────────────────

/**
 * One aligned token in a parsed verse.
 *
 * `text` is the English word/phrase (may be empty when the original-language
 * word has no direct English counterpart — e.g. an article or particle that
 * the KJV elides). `strong` is the Strong's number with a single-letter
 * prefix: `H1234` for Hebrew (OT books), `G2316` for Greek (NT).
 */
export interface VerseToken {
  text: string;
  strong: string | null;
}

export interface ParsedVerse {
  verse: number;
  tokens: VerseToken[];
  /** Plain English text of the verse (Strong's tags + footnotes stripped). */
  plain: string;
}

const STRONG_TAG_RE = /<S>(\d+)<\/S>/g;

function stripFootnotes(html: string): string {
  return html
    .replace(/<sup>[\s\S]*?<\/sup>/g, "")
    .replace(/<i>[\s\S]*?<\/i>/g, "")
    .replace(/<f>[\s\S]*?<\/f>/g, "")
    .replace(/<n>[\s\S]*?<\/n>/g, "");
}

/** Convert a bolls KJV verse `text` field into aligned tokens. */
export function parseVerseTokens(
  rawHtml: string,
  testament: "OT" | "NT",
): { tokens: VerseToken[]; plain: string } {
  const cleaned = stripFootnotes(rawHtml);
  const prefix = testament === "OT" ? "H" : "G";
  const tokens: VerseToken[] = [];

  let cursor = 0;
  let m: RegExpExecArray | null;
  STRONG_TAG_RE.lastIndex = 0;
  while ((m = STRONG_TAG_RE.exec(cleaned))) {
    const chunk = cleaned.slice(cursor, m.index);
    const strong = `${prefix}${m[1]}`;
    const text = chunk.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    // Always emit a token — keeps order intact for "extra Strong's" tokens
    // that have no English text directly above them.
    tokens.push({ text, strong });
    cursor = STRONG_TAG_RE.lastIndex;
  }
  // Trailing English with no trailing Strong's (e.g. punctuation).
  const tail = cleaned.slice(cursor).replace(/\s+/g, " ").trim();
  if (tail) tokens.push({ text: tail, strong: null });

  // Build plain text by joining all chunks (including those without Strong's).
  const plain = cleaned
    .replace(STRONG_TAG_RE, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { tokens, plain };
}

// ─── Network ─────────────────────────────────────────────────────────────────

const BASE = "https://bolls.life";

interface BollsVerseRow {
  pk: number;
  verse: number;
  text: string;
}

/**
 * Fetch a whole chapter; returns one entry per verse, already tokenized for
 * the interlinear view. `translationId` is a slug from
 * `lib/bible/translations.ts`; if it doesn't cover the requested book's
 * testament (e.g. WLCa for an NT book), we transparently fall back to the
 * default translation so the reader never breaks on a stale picker.
 */
export async function fetchChapter(
  bookId: string,
  chapter: number,
  translationId: string = DEFAULT_TRANSLATION_ID,
): Promise<ParsedVerse[]> {
  const bolls = bollsIdFor(bookId);
  if (!bolls) throw new Error(`Unknown book id: ${bookId}`);
  const testament: "OT" | "NT" = bolls <= 39 ? "OT" : "NT";

  const requested = getTranslation(translationId);
  const translation = translationCovers(requested, testament)
    ? requested
    : getTranslation(DEFAULT_TRANSLATION_ID);

  const url = `${BASE}/get-text/${translation.id}/${bolls}/${chapter}/`;
  const res = await fetch(url, {
    // Cache for an hour at the edge — Scripture text is immutable.
    next: { revalidate: 3600 },
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `bolls.life ${res.status} for ${translation.id} ${bookId} ${chapter}`,
    );
  }
  const rows = (await res.json()) as BollsVerseRow[];
  return rows.map((r) => {
    const { tokens, plain } = parseVerseTokens(r.text, testament);
    return { verse: r.verse, tokens, plain };
  });
}

// ─── Dictionary ──────────────────────────────────────────────────────────────

export interface WordStudy {
  strong: string;
  /** Hebrew or Greek lemma with vowel/accent marks. */
  lexeme: string;
  transliteration: string;
  pronunciation: string;
  /** One-or-two-word gloss for the inline mini word-study row. */
  shortGloss: string;
  /** Full BDB / Thayer's HTML for the hover/click popover. */
  detailHtml: string;
}

export interface BollsDictRow {
  topic: string;
  definition: string;
  lexeme: string;
  transliteration: string;
  pronunciation: string;
  short_definition: string;
  weight: number;
}

// Process-wide cache so popular words aren't re-fetched on every request.
const dictCache = new Map<string, WordStudy>();

async function fetchOneWord(strong: string): Promise<WordStudy | null> {
  const cached = dictCache.get(strong);
  if (cached) return cached;

  const url = `${BASE}/dictionary-definition/BDBT/${encodeURIComponent(strong)}/`;
  const res = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 * 30 }, // 30 days
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as BollsDictRow[];
  const row = rows.find((r) => r.topic === strong) ?? rows[0];
  if (!row) return null;

  const study: WordStudy = {
    strong,
    lexeme: row.lexeme ?? "",
    transliteration: row.transliteration ?? "",
    pronunciation: row.pronunciation ?? "",
    shortGloss: pickShortGloss(row),
    detailHtml: row.definition ?? "",
  };
  dictCache.set(strong, study);
  return study;
}

/**
 * Pick a 1–3-word gloss to render directly under each lemma.
 *
 * The bolls.life `short_definition` field is keyed for *reverse lookup*
 * (English → Strong's), so it's often a tertiary sense — e.g. G2316
 * (`theós`) comes back as "exceeding" rather than "God". We instead reach
 * for senses in this order:
 *
 *   1. The first italicized word in the Strong's gloss line that lives at
 *      the bottom of every BDB / Thayer's entry — those are the canonical
 *      one-word KJV renderings ("deity", "create", "love").
 *   2. The first sense in Thayer's numbered list (Greek).
 *   3. The first item in the BDB ordered list (Hebrew).
 *   4. The reverse-lookup short_definition.
 */
export function pickShortGloss(row: BollsDictRow): string {
  const html = row.definition ?? "";

  const strongsIdx = html.lastIndexOf("Strongs:");
  if (strongsIdx >= 0) {
    const tail = html.slice(strongsIdx);
    // Walk every italic in the Strong's gloss line. Skip phonetic-style
    // transliterations (e.g. "hoo-toce", "log-os") which appear at the
    // top of a few entries. Prefer multi-word phrases ("in this way") if
    // present, otherwise the first real one-word gloss.
    const italics = Array.from(tail.matchAll(/<i>([^<]+)<\/i>/g)).map((m) =>
      m[1].trim(),
    );
    const looksPhonetic = (s: string) =>
      !/\s/.test(s) && /[a-z]+-[a-z]+/i.test(s);
    const phrase = italics.find((s) => /\s/.test(s) && !looksPhonetic(s));
    if (phrase) return condense(phrase);
    const word = italics.find((s) => !looksPhonetic(s));
    if (word) return condense(word);
  }

  // BDB sub-sense: the first <ol type=a><li>real gloss</li> after the
  // category-level item. This is where the actual word meanings live for
  // Hebrew entries that start with category headers like "(plural)".
  const bdbSubSense = html.match(/<ol\s+type=a[^>]*>\s*<li[^>]*>\s*([^<]+)/i);
  if (bdbSubSense) return condense(bdbSubSense[1]);

  const thayer = html.match(/<b>\s*1\.\s*<\/b>\s*([^<]+)/);
  if (thayer && !/^\(/.test(thayer[1].trim())) return condense(thayer[1]);

  const bdbList = html.match(/<ol[^>]*>\s*<li[^>]*>\s*([^<]+)/i);
  if (bdbList && !/^\(/.test(bdbList[1].trim())) return condense(bdbList[1]);

  const li = html.match(/<li[^>]*>\s*([^<]+)/i);
  if (li) return condense(li[1]);

  const sd = (row.short_definition ?? "").trim();
  if (sd) return condense(sd);
  return "—";
}

function condense(s: string): string {
  // Strip leading verb-stem markers BDB sticks on every Hebrew verb sense
  // ("(Qal) to create" → "to create"). Same idea for Niphal, Piel, etc.
  const cleaned = s
    .replace(/\s+/g, " ")
    .replace(/^\s*\((Qal|Niphal|Piel|Pual|Hiphil|Hophal|Hithpael|Po'?al|Pilpel|passive|active|participle|imperfect|perfect|infinitive|imperative|cohortative|jussive)\)\s*/i, "")
    .trim();
  // Take only the first comma-separated sense (BDB stacks 4–6 of them).
  const firstSense = cleaned.split(/[,;]/)[0].trim();
  if (firstSense.length <= 24) return firstSense;
  return firstSense.slice(0, 22).trimEnd() + "…";
}

/** Fetch many word studies in parallel; missing entries are simply omitted. */
export async function fetchWordStudies(
  strongs: readonly string[],
): Promise<Record<string, WordStudy>> {
  const unique = Array.from(new Set(strongs.filter(Boolean)));
  const results = await Promise.all(unique.map((s) => fetchOneWord(s)));
  const out: Record<string, WordStudy> = {};
  for (const r of results) {
    if (r) out[r.strong] = r;
  }
  return out;
}
