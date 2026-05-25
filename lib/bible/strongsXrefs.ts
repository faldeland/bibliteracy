// Cross-references for every verse where a Strong's number appears (KJV
// concordance), de-duplicated by destination passage.

import { formatRef } from "./parseRef";
import { lookupStrongsOccurrences } from "./strongsConcordance";
import { lookupXRefs } from "./xrefs";
import type { StrongsVerseRef } from "./strongsConcordance";

export interface StrongsXRefRow {
  to: {
    book: string;
    chapter: number;
    verseStart?: number;
    verseEnd?: number;
  };
  toLabel: string;
  category:
    | "ot-in-nt"
    | "synoptic-parallel"
    | "thematic-chain"
    | "messianic"
    | "narrative-parallel";
  note: string;
  /** Occurrence verse that surfaced this cross-reference. */
  fromVerse: { book: string; chapter: number; verse: number };
  fromVerseLabel: string;
}

/**
 * Collect curated cross-references from every `verses` entry, de-duplicated
 * by destination passage (canon order).
 */
export function collectStrongsXRefs(
  verses: StrongsVerseRef[],
): StrongsXRefRow[] {
  const seen = new Set<string>();
  const out: StrongsXRefRow[] = [];

  for (const v of verses) {
    const query = { book: v.book, chapter: v.chapter, verseStart: v.verse };
    for (const hit of lookupXRefs(query)) {
      const key = `${hit.to.book}:${hit.to.chapter}:${hit.to.verseStart ?? ""}:${hit.to.verseEnd ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        to: {
          book: hit.to.book,
          chapter: hit.to.chapter,
          verseStart: hit.to.verseStart,
          verseEnd: hit.to.verseEnd,
        },
        toLabel: formatRef(hit.to),
        category: hit.category,
        note: hit.note,
        fromVerse: { book: v.book, chapter: v.chapter, verse: v.verse },
        fromVerseLabel: formatRef(query),
      });
    }
  }

  return out;
}

let cache: Map<string, { count: number; xrefs: StrongsXRefRow[] }> | null =
  null;

/** Reset in-memory cache (tests only). */
export function resetStrongsXrefsCache(): void {
  cache = null;
}

/**
 * Cross-references for every verse containing `strong`, cached per Strong's
 * number for the process lifetime.
 */
export async function lookupStrongsXRefs(
  strong: string,
): Promise<{ count: number; xrefs: StrongsXRefRow[] } | null> {
  if (!cache) cache = new Map();
  const hit = cache.get(strong);
  if (hit) return hit;

  const occ = await lookupStrongsOccurrences(strong);
  if (!occ) return null;

  const xrefs = collectStrongsXRefs(occ.verses);
  const result = { count: xrefs.length, xrefs };
  cache.set(strong, result);
  return result;
}
