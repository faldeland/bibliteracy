import { BIBLE_BOOKS } from "@/lib/bible/books";
import { verseCount } from "@/lib/bible/versesPerChapter";

/** localStorage key for the last verse the user was reading. */
export const LAST_VIEW_STORAGE_KEY = "bibliteracy:bible:lastView";

export interface BiblePosition {
  bookId: string;
  chapter: number;
  verse: number;
}

/** Validate a parsed JSON value before restoring reader position. */
export function parseStoredLastView(raw: unknown): BiblePosition | null {
  if (!raw || typeof raw !== "object") return null;
  const { bookId, chapter, verse } = raw as Record<string, unknown>;
  if (
    typeof bookId !== "string" ||
    typeof chapter !== "number" ||
    typeof verse !== "number"
  ) {
    return null;
  }
  if (
    !Number.isInteger(chapter) ||
    !Number.isInteger(verse) ||
    chapter < 1 ||
    verse < 1
  ) {
    return null;
  }
  if (!BIBLE_BOOKS.some((b) => b.id === bookId)) return null;
  const maxVerse = verseCount(bookId, chapter);
  if (maxVerse === null || verse > maxVerse) return null;
  return { bookId, chapter, verse };
}

export function readLastView(): BiblePosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    if (!raw) return null;
    return parseStoredLastView(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLastView(position: BiblePosition): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LAST_VIEW_STORAGE_KEY,
      JSON.stringify(position),
    );
  } catch {
    // ignore quota / privacy mode
  }
}
