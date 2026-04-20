import { BIBLE_BOOKS } from "@/lib/bible/books";
import type { BibleRef, Dot } from "./types";

export interface ConnectorEdge {
  key: string;
  dotId: string;
  bookId: string;
  /** Strength in [0,1] driving stroke opacity / width. */
  weight: number;
  /** Specific reference; lets the book anchor estimate where to land. */
  ref?: BibleRef;
}

export interface BuildEdgesInput {
  dots: Dot[];
  hoverDotId: string | null;
  hoverBookId: string | null;
  selectedBookId: string | null;
  showAll: boolean;
}

/**
 * Given the current set of visible dots and the hover/selection state, return
 * the ordered list of (dot -> book) edges to draw. Pure function — no DOM
 * access — so it can be unit tested and memoized cheaply.
 *
 * Edges are deduped by key: a dot referencing a selected/hovered book only
 * produces one edge even when multiple display reasons apply.
 */
export function buildConnectorEdges(input: BuildEdgesInput): ConnectorEdge[] {
  const { dots, hoverDotId, hoverBookId, selectedBookId, showAll } = input;
  const list: ConnectorEdge[] = [];

  if (showAll) {
    for (const d of dots) {
      const seenBooks = new Set<string>();
      for (const r of d.refs) {
        if (seenBooks.has(r.book)) continue;
        seenBooks.add(r.book);
        list.push({
          key: `all:${d.id}->${r.book}`,
          dotId: d.id,
          bookId: r.book,
          weight: 0.5,
          ref: r,
        });
      }
    }
  }

  if (selectedBookId) {
    for (const d of dots) {
      const ref = d.refs.find((r) => r.book === selectedBookId);
      if (ref) {
        list.push({
          key: `${d.id}->${selectedBookId}`,
          dotId: d.id,
          bookId: selectedBookId,
          weight: 0.85,
          ref,
        });
      }
    }
  }

  if (hoverDotId) {
    const d = dots.find((x) => x.id === hoverDotId);
    if (d) {
      for (const r of d.refs) {
        list.push({
          key: `${d.id}->${r.book}`,
          dotId: d.id,
          bookId: r.book,
          weight: 1,
          ref: r,
        });
      }
    }
  }

  if (hoverBookId) {
    for (const d of dots) {
      const ref = d.refs.find((r) => r.book === hoverBookId);
      if (ref) {
        list.push({
          key: `${d.id}->${hoverBookId}`,
          dotId: d.id,
          bookId: hoverBookId,
          weight: 0.9,
          ref,
        });
      }
    }
  }

  const seen = new Set<string>();
  return list.filter((e) =>
    seen.has(e.key) ? false : (seen.add(e.key), true),
  );
}

const CHAPTERS_BY_BOOK: Map<string, number> = new Map(
  BIBLE_BOOKS.map((b) => [b.id, b.chapters]),
);

/**
 * Estimate where inside a book bar a reference points to, returned as a
 * fraction in [0,1] (0 = book start, 1 = book end). Deliberately coarse: we
 * only need the anchor to land on the correct half of the book bar.
 */
export function refFraction(bookId: string, ref?: BibleRef): number {
  if (!ref) return 0.5;
  const chapters = CHAPTERS_BY_BOOK.get(bookId);
  if (!chapters || chapters <= 0) return 0.5;
  const chapter = Math.max(1, Math.min(chapters, ref.chapter || 1));
  const VERSES_PER_CHAPTER_GUESS = 30;
  let verseFrac = 0.5;
  if (ref.verseStart && ref.verseStart > 0) {
    const start = ref.verseStart;
    const end = ref.verseEnd && ref.verseEnd >= start ? ref.verseEnd : start;
    const mid = (start + end) / 2;
    verseFrac = Math.max(
      0,
      Math.min(1, (mid - 0.5) / VERSES_PER_CHAPTER_GUESS),
    );
  }
  return (chapter - 1 + verseFrac) / chapters;
}
