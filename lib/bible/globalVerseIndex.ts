// Global verse index — a single 0-based position for every verse in the
// Protestant 66-book canon, in the order they appear in BIBLE_BOOKS (TaNaK
// + NT). This is the coordinate system used by the cross-references
// firehose: every (book, chapter, verse) collapses to a single integer in
// [0, TOTAL_KJV_VERSES), which we use as an x-position when rendering arcs.
//
// Why a single index instead of a 3-tuple:
//   • Lets us pack 64k+ cross-reference pairs as a flat Uint32Array
//     (~512 KB raw, ~250 KB gzipped) for the canvas renderer.
//   • Gives the firehose visualization a stable, monotone x-axis without
//     having to call into the books layout on every arc.
//   • The inverse lookup (`verseFromIndex`) lets tooltips and click-through
//     resolve back to a real BibleRef.

import { BIBLE_BOOKS } from "./books";
import { VERSES_PER_CHAPTER, TOTAL_KJV_VERSES } from "./versesPerChapter";

interface BookOffset {
  bookId: string;
  /** Inclusive global verse index of the book's first verse. */
  start: number;
  /** Exclusive end — equal to the next book's `start`. */
  end: number;
  /** Cumulative verses-before-chapter, indexed by chapter-1. */
  chapterStarts: number[];
}

const BOOK_OFFSETS: BookOffset[] = (() => {
  const out: BookOffset[] = [];
  let cursor = 0;
  for (const book of BIBLE_BOOKS) {
    const verses = VERSES_PER_CHAPTER[book.id];
    if (!verses) {
      throw new Error(
        `globalVerseIndex: no VERSES_PER_CHAPTER entry for ${book.id}`,
      );
    }
    const chapterStarts: number[] = new Array(verses.length);
    let local = 0;
    for (let i = 0; i < verses.length; i++) {
      chapterStarts[i] = cursor + local;
      local += verses[i];
    }
    const start = cursor;
    cursor += local;
    out.push({ bookId: book.id, start, end: cursor, chapterStarts });
  }
  if (cursor !== TOTAL_KJV_VERSES) {
    throw new Error(
      `globalVerseIndex: sum of book verses (${cursor}) !== TOTAL_KJV_VERSES (${TOTAL_KJV_VERSES})`,
    );
  }
  return out;
})();

const BOOK_OFFSET_BY_ID: Map<string, BookOffset> = (() => {
  const m = new Map<string, BookOffset>();
  for (const b of BOOK_OFFSETS) m.set(b.bookId, b);
  return m;
})();

export const TOTAL_VERSES = TOTAL_KJV_VERSES;

/** Range covered by a book in the global verse index, [start, end). */
export function bookRange(bookId: string): { start: number; end: number } | null {
  const o = BOOK_OFFSET_BY_ID.get(bookId);
  return o ? { start: o.start, end: o.end } : null;
}

/**
 * Convert (book, chapter, verse) → global verse index in [0, TOTAL_VERSES).
 * Returns null for unknown books or out-of-range chapter/verse.
 */
export function verseIndex(
  bookId: string,
  chapter: number,
  verse: number,
): number | null {
  const o = BOOK_OFFSET_BY_ID.get(bookId);
  if (!o) return null;
  const verses = VERSES_PER_CHAPTER[bookId];
  if (chapter < 1 || chapter > verses.length) return null;
  const verseCount = verses[chapter - 1];
  if (verse < 1 || verse > verseCount) return null;
  return o.chapterStarts[chapter - 1] + (verse - 1);
}

/**
 * Inverse of `verseIndex` — used by tooltips on the firehose to resolve a
 * hovered arc endpoint back to a real BibleRef.
 *
 * O(log books + log chapters) via binary search.
 */
export function verseFromIndex(
  idx: number,
): { book: string; chapter: number; verse: number } | null {
  if (idx < 0 || idx >= TOTAL_VERSES) return null;
  // Binary-search the book.
  let lo = 0;
  let hi = BOOK_OFFSETS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (BOOK_OFFSETS[mid].end <= idx) lo = mid + 1;
    else hi = mid;
  }
  const book = BOOK_OFFSETS[lo];
  // Binary-search the chapter.
  const cs = book.chapterStarts;
  lo = 0;
  hi = cs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (cs[mid] > idx) hi = mid - 1;
    else lo = mid;
  }
  const chapter = lo + 1;
  const verse = idx - cs[lo] + 1;
  return { book: book.bookId, chapter, verse };
}
