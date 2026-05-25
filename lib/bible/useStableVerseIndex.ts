import { useMemo, useRef } from "react";
import type { BibleRef } from "@/lib/grid/types";
import { verseIndex } from "./globalVerseIndex";

/**
 * Global verse index for the active passage. Holds the last valid index
 * across brief null gaps while BibleReader syncs `currentBibleRef` so strip
 * UI does not unmount the active-verse marker mid-navigation.
 */
export function useStableVerseIndex(
  bibleRef: BibleRef | null | undefined,
): number | null {
  const lastRef = useRef<number | null>(null);

  return useMemo(() => {
    if (!bibleRef) return lastRef.current;
    const v = bibleRef.verseStart ?? 1;
    const idx = verseIndex(bibleRef.book, bibleRef.chapter, v);
    if (idx != null) lastRef.current = idx;
    return idx ?? lastRef.current;
  }, [bibleRef]);
}
