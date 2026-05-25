import { verseFromIndex } from "./globalVerseIndex";

export interface VerseCrossRefSpoke {
  pairIdx: number;
  fromIdx: number;
  toIdx: number;
  fromRef: { book: string; chapter: number; verse: number };
  toRef: { book: string; chapter: number; verse: number };
}

/** Packed pairs where either endpoint is `activeIdx`. */
export function collectVerseCrossRefSpokes(
  pairs: Uint32Array,
  activeIdx: number,
): VerseCrossRefSpoke[] {
  const out: VerseCrossRefSpoke[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const fromIdx = pairs[i]!;
    const toIdx = pairs[i + 1]!;
    if (fromIdx !== activeIdx && toIdx !== activeIdx) continue;
    const fromRef = verseFromIndex(fromIdx);
    const toRef = verseFromIndex(toIdx);
    if (!fromRef || !toRef) continue;
    out.push({ pairIdx: i, fromIdx, toIdx, fromRef, toRef });
  }
  return out;
}
