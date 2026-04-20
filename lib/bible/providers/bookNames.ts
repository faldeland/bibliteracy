// English book-name resolution for the publisher APIs that accept
// human-readable references ("John 3", "1 Corinthians 13") rather than
// numeric ids. ESV / NLT / NET all use the same English names with very
// minor divergences (Song of Songs vs Song of Solomon, etc.) — we keep one
// canonical map here and let providers override per-id where needed.

import { BIBLE_BOOKS, type BibleBook } from "../books";

const OVERRIDES: Record<string, string> = {
  // bolls / our internal id "Sng" → "Song of Songs". Most modern English
  // APIs accept "Song of Solomon" too; use that for compatibility.
  Sng: "Song of Solomon",
};

/**
 * Resolves our internal book id to the English name expected by ESV / NLT /
 * NET. Throws if the id isn't known.
 */
export function publisherBookName(book: BibleBook): string {
  return OVERRIDES[book.id] ?? book.name;
}

export function bookByIdOrThrow(id: string): BibleBook {
  const b = BIBLE_BOOKS.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown book id: ${id}`);
  return b;
}
