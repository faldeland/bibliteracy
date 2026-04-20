// Bolls.life adapter. Delegates to the existing fetcher in `bollsApi.ts`,
// which already does Strong's-tag parsing for the translations that carry
// them. Kept as a thin shim so the provider dispatcher has one consistent
// signature for every source.

import { fetchChapter as fetchBollsChapter } from "../bollsApi";
import type { ParsedVerse } from "./types";

export async function fetchChapter(
  bookId: string,
  chapter: number,
  translationId: string,
): Promise<ParsedVerse[]> {
  return fetchBollsChapter(bookId, chapter, translationId);
}
