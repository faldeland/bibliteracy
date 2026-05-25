// Client loader for Strong's concordance hits. Fetches from
// /api/bible/strongs and maps verse refs to global verse indices for canvas
// rendering. Results are cached per Strong's number.

import { verseIndex } from "./globalVerseIndex";

export interface StrongsOccurrenceData {
  strong: string;
  count: number;
  /** Sorted global verse indices where this Strong's number appears. */
  indices: Uint32Array;
}

interface ApiVerse {
  book: string;
  chapter: number;
  verse: number;
}

interface ApiResponse {
  strong?: string;
  count?: number;
  verses?: ApiVerse[];
  error?: string;
}

const cache = new Map<string, Promise<StrongsOccurrenceData>>();

export function loadStrongsOccurrences(
  strong: string,
): Promise<StrongsOccurrenceData> {
  const existing = cache.get(strong);
  if (existing) return existing;

  const promise = (async () => {
    const qs = new URLSearchParams({ strong });
    const res = await fetch(`/api/bible/strongs?${qs.toString()}`);
    const data = (await res.json()) as ApiResponse;
    if (!res.ok || data.error) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    const verses = data.verses ?? [];
    const indices = new Uint32Array(verses.length);
    let n = 0;
    for (const v of verses) {
      const idx = verseIndex(v.book, v.chapter, v.verse);
      if (idx == null) continue;
      indices[n++] = idx;
    }
    return {
      strong: data.strong ?? strong,
      count: data.count ?? n,
      indices: n === indices.length ? indices : indices.slice(0, n),
    };
  })();

  cache.set(strong, promise);
  return promise;
}

/** Clear cached lookups (tests only). */
export function resetStrongsClientCache(): void {
  cache.clear();
}
