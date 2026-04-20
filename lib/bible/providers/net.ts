// Bible.org Labs API adapter — keyless, JSON, free with attribution.
//
// Endpoint: https://labs.bible.org/api/?passage=<ref>&type=json
// Docs:     https://labs.bible.org/api_web_service
//
// The Labs API has a soft rate limit ("a few hundred requests per day from
// any one IP") and is the only legitimate free way to serve NET text. Their
// TOS requires the (NET) attribution string carried by the registry entry.

import { VERSES_PER_CHAPTER } from "../versesPerChapter";
import { bookByIdOrThrow, publisherBookName } from "./bookNames";
import {
  ProviderUpstreamError,
  type ParsedVerse,
} from "./types";

interface NetVerseRow {
  bookname: string;
  chapter: string;
  verse: string;
  text: string;
}

const BASE = "https://labs.bible.org/api/";
/**
 * The Labs API silently truncates to a single verse when *any* part of a
 * verse range is out-of-bounds for the chapter (e.g. asking for John 3:31-60
 * returns only verse 31). To work around that we page in fixed windows,
 * clamped against our local KJV verse-count table — which is the same source
 * of truth the rest of the app uses for verse pickers and ref parsing.
 */
const PAGE = 25;

export async function fetchChapter(
  bookId: string,
  chapter: number,
): Promise<ParsedVerse[]> {
  const book = bookByIdOrThrow(bookId);
  const counts = VERSES_PER_CHAPTER[book.id];
  const lastVerse = counts?.[chapter - 1];
  if (!Number.isFinite(lastVerse) || !lastVerse) {
    throw new ProviderUpstreamError(
      `Don't know verse count for ${book.id} ${chapter}; can't page bible.org`,
    );
  }

  const verses: NetVerseRow[] = [];
  for (let start = 1; start <= lastVerse; start += PAGE) {
    const end = Math.min(start + PAGE - 1, lastVerse);
    const pageRef = `${publisherBookName(book)} ${chapter}:${start}-${end}`;
    const url = `${BASE}?passage=${encodeURIComponent(pageRef)}&type=json&formatting=plain`;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new ProviderUpstreamError(
        `bible.org Labs ${res.status} for "${pageRef}"`,
        res.status,
      );
    }
    const text = await res.text();
    if (/^\s*Sorry/i.test(text)) continue;
    let rows: NetVerseRow[];
    try {
      rows = JSON.parse(text) as NetVerseRow[];
    } catch {
      throw new ProviderUpstreamError(
        `bible.org Labs returned non-JSON for "${pageRef}"`,
      );
    }
    if (!Array.isArray(rows) || rows.length === 0) continue;
    verses.push(...rows);
  }

  return verses
    .map((row) => {
      const v = Number.parseInt(row.verse, 10);
      const plain = row.text.trim();
      return {
        verse: v,
        plain,
        tokens: [{ text: plain, strong: null }],
      };
    })
    .filter((v) => Number.isFinite(v.verse))
    .sort((a, b) => a.verse - b.verse);
}
