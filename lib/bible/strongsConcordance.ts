// Server-side lookup for the KJV Strong's concordance shipped in public/data/.
//
// Each Strong's number maps to the sorted list of global verse indices (see
// globalVerseIndex.ts) where that number appears at least once in the verse.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { verseFromIndex } from "./globalVerseIndex";

export interface StrongsVerseRef {
  book: string;
  chapter: number;
  verse: number;
}

export interface StrongsOccurrences {
  strong: string;
  /** Number of distinct verses containing this Strong's number. */
  count: number;
  verses: StrongsVerseRef[];
}

interface StrongsEntry {
  offset: number;
  count: number;
}

interface StrongsMeta {
  version: number;
  strongCount: number;
  totalHits: number;
  index: Record<string, StrongsEntry>;
}

interface LoadedIndex {
  meta: StrongsMeta;
  data: Uint32Array;
}

const STRONG_RE = /^[GH]\d+$/;

let loadPromise: Promise<LoadedIndex> | null = null;

async function loadIndex(): Promise<LoadedIndex> {
  const root = process.cwd();
  const metaPath = join(root, "public/data/strongs.meta.json");
  const binPath = join(root, "public/data/strongs.bin");
  const [metaRaw, bin] = await Promise.all([
    readFile(metaPath, "utf8"),
    readFile(binPath),
  ]);
  const meta = JSON.parse(metaRaw) as StrongsMeta;
  const data = new Uint32Array(
    bin.buffer,
    bin.byteOffset,
    bin.byteLength / 4,
  );
  return { meta, data };
}

function getIndex(): Promise<LoadedIndex> {
  if (!loadPromise) loadPromise = loadIndex();
  return loadPromise;
}

/** Reset the in-memory cache (tests only). */
export function resetStrongsConcordanceCache(): void {
  loadPromise = null;
}

/**
 * Return every verse (deduplicated per verse) where `strong` appears in KJV
 * interlinear markup. Unknown or malformed Strong's numbers return null.
 */
export async function lookupStrongsOccurrences(
  strong: string,
): Promise<StrongsOccurrences | null> {
  if (!STRONG_RE.test(strong)) return null;

  const { meta, data } = await getIndex();
  const entry = meta.index[strong];
  if (!entry) {
    return { strong, count: 0, verses: [] };
  }

  const verses: StrongsVerseRef[] = [];
  for (let i = 0; i < entry.count; i++) {
    const gvi = data[entry.offset + i]!;
    const ref = verseFromIndex(gvi);
    if (ref) verses.push(ref);
  }

  return { strong, count: entry.count, verses };
}
