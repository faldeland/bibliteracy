// Lookup helpers for the curated CROSS_REFERENCES dataset.
//
// We index references by (book, chapter) so a query for any verse in a
// chapter returns every cross-reference whose `from` overlaps the queried
// verse range. Returned hits are de-duplicated and sorted in canon order.

import { CROSS_REFERENCES, type CrossReference } from "./crossRefs";
import { BIBLE_BOOKS } from "./books";
import type { BibleRef } from "@/lib/grid/types";

const BOOK_ORDER: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const b of BIBLE_BOOKS) m[b.id] = b.order;
  return m;
})();

const INDEX: Map<string, CrossReference[]> = (() => {
  const m = new Map<string, CrossReference[]>();
  for (const ref of CROSS_REFERENCES) {
    const key = `${ref.from.book}:${ref.from.chapter}`;
    const list = m.get(key) ?? [];
    list.push(ref);
    m.set(key, list);
  }
  return m;
})();

/**
 * Two verse-ranges overlap if neither is strictly above or below the other.
 * Chapter-level refs (verseStart === undefined) are treated as covering the
 * whole chapter.
 */
function rangesOverlap(a: BibleRef, b: BibleRef): boolean {
  if (a.book !== b.book || a.chapter !== b.chapter) return false;
  const aStart = a.verseStart ?? 1;
  const aEnd = a.verseEnd ?? a.verseStart ?? Infinity;
  const bStart = b.verseStart ?? 1;
  const bEnd = b.verseEnd ?? b.verseStart ?? Infinity;
  return aStart <= bEnd && bStart <= aEnd;
}

function refKey(r: BibleRef): string {
  return `${r.book}:${r.chapter}:${r.verseStart ?? ""}:${r.verseEnd ?? ""}`;
}

function compareRefs(a: BibleRef, b: BibleRef): number {
  const ao = BOOK_ORDER[a.book] ?? 999;
  const bo = BOOK_ORDER[b.book] ?? 999;
  if (ao !== bo) return ao - bo;
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return (a.verseStart ?? 0) - (b.verseStart ?? 0);
}

export interface XRefHit {
  /** The cross-reference target. */
  to: BibleRef;
  category: CrossReference["category"];
  note: string;
  /** The original `from` reference that generated this hit (for debugging/UI). */
  from: BibleRef;
}

/**
 * Return every cross-reference whose `from` overlaps the queried passage.
 * Results are flattened (one per target), de-duplicated by destination, and
 * sorted in canon order.
 */
export function lookupXRefs(query: BibleRef): XRefHit[] {
  const candidates = INDEX.get(`${query.book}:${query.chapter}`) ?? [];
  const out: XRefHit[] = [];
  const seen = new Set<string>();
  for (const xref of candidates) {
    if (!rangesOverlap(xref.from, query)) continue;
    for (const to of xref.to) {
      const k = refKey(to);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ to, category: xref.category, note: xref.note, from: xref.from });
    }
  }
  out.sort((a, b) => compareRefs(a.to, b.to));
  return out;
}

/** Total number of curated cross-references in the dataset. */
export function crossReferenceCount(): number {
  return CROSS_REFERENCES.length;
}
