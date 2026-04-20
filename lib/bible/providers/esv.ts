// Crossway ESV API adapter — official api.esv.org, free tier (5000 verses
// per day per key, non-commercial / personal use only by default).
//
// Get a key: https://api.esv.org/account/create-application/
// Docs:      https://api.esv.org/docs/passage-text/
//
// Set ESV_API_KEY in .env.local. The key is server-only — this module is
// only called from the /api/bible/chapter route.

import { bookByIdOrThrow, publisherBookName } from "./bookNames";
import {
  ProviderConfigError,
  ProviderUpstreamError,
  type ParsedVerse,
} from "./types";

const BASE = "https://api.esv.org/v3/passage/text/";

interface EsvResponse {
  canonical: string;
  passages: string[];
  parsed: number[][];
}

export async function fetchChapter(
  bookId: string,
  chapter: number,
): Promise<ParsedVerse[]> {
  const key = process.env.ESV_API_KEY;
  if (!key) {
    throw new ProviderConfigError(
      "ESV_API_KEY is not set. Get a free key at api.esv.org and add it to .env.local.",
    );
  }
  const book = bookByIdOrThrow(bookId);
  const ref = `${publisherBookName(book)} ${chapter}`;

  // Request a clean, predictable text format we can parse reliably.
  const params = new URLSearchParams({
    q: ref,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
  });

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: {
      authorization: `Token ${key}`,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { detail?: string };
      if (j?.detail) detail = ` — ${j.detail}`;
    } catch {
      // ignore parse errors
    }
    throw new ProviderUpstreamError(
      `api.esv.org ${res.status} for "${ref}"${detail}`,
      res.status,
    );
  }
  const data = (await res.json()) as EsvResponse;
  const passage = (data.passages?.[0] ?? "").trim();
  if (!passage) return [];

  return parseEsvPassage(passage);
}

/**
 * The ESV API's text format prefixes each verse with `[N]` (or `[N:N]` at
 * paragraph starts) and runs verses together within paragraphs. We split on
 * those markers, collapsing whitespace so the rendered paragraph reads
 * cleanly.
 */
function parseEsvPassage(text: string): ParsedVerse[] {
  const VERSE_RE = /\[(\d+)(?::\d+)?\]\s*/g;
  const out: ParsedVerse[] = [];
  let m: RegExpExecArray | null;
  let cur: { verse: number; start: number } | null = null;
  const flush = (endIdx: number) => {
    if (!cur) return;
    const slice = text.slice(cur.start, endIdx).replace(/\s+/g, " ").trim();
    if (slice) {
      out.push({
        verse: cur.verse,
        plain: slice,
        tokens: [{ text: slice, strong: null }],
      });
    }
  };
  VERSE_RE.lastIndex = 0;
  while ((m = VERSE_RE.exec(text))) {
    flush(m.index);
    cur = { verse: Number.parseInt(m[1], 10), start: VERSE_RE.lastIndex };
  }
  flush(text.length);
  return out;
}
