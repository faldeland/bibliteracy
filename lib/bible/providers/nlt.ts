// Tyndale NLT API adapter — official api.nlt.to, free with API key.
//
// Get a key: https://api.nlt.to/  (sign in, generate an API key)
// Docs:      https://api.nlt.to/  (the same page)
//
// Set NLT_API_KEY in .env.local. Server-only — only called from
// /api/bible/chapter.
//
// The NLT API returns HTML that wraps each verse in a <verse_export> element
// with attributes like vn="3" bk="John" ch="3", followed by inline tags
// (<span class="vn">3</span>, footnotes in <a class="a-tn">, etc.). We strip
// the HTML, drop footnotes, and split by verse number.

import { bookByIdOrThrow, publisherBookName } from "./bookNames";
import {
  ProviderConfigError,
  ProviderUpstreamError,
  type ParsedVerse,
} from "./types";

const BASE = "https://api.nlt.to/api/passages";

// NLT API has its own quirks for a handful of books — it does NOT accept
// "SongofSolomon" (returns empty), but "Song" works. Keep these overrides
// local to the adapter so other providers aren't affected.
const NLT_BOOK_OVERRIDES: Record<string, string> = {
  Sng: "Song",
};

export async function fetchChapter(
  bookId: string,
  chapter: number,
): Promise<ParsedVerse[]> {
  const key = process.env.NLT_API_KEY;
  if (!key) {
    throw new ProviderConfigError(
      "NLT_API_KEY is not set. Get a free key at api.nlt.to and add it to .env.local.",
    );
  }
  const book = bookByIdOrThrow(bookId);
  // NLT API takes "Book.Chapter[.Verse]". The book may contain spaces
  // ("1 Corinthians.13") — keep them; URLSearchParams will encode them.
  // Stripping spaces produces "1Corinthians" which the API rejects.
  const bookName = NLT_BOOK_OVERRIDES[book.id] ?? publisherBookName(book);
  const ref = `${bookName}.${chapter}`;

  const params = new URLSearchParams({
    ref,
    version: "NLT",
    key,
  });

  const url = `${BASE}?${params.toString()}`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { accept: "text/html" },
  });
  if (!res.ok) {
    throw new ProviderUpstreamError(
      `api.nlt.to ${res.status} for "${ref}"`,
      res.status,
    );
  }
  const html = await res.text();
  return parseNltHtml(html);
}

/**
 * Parse the NLT API's HTML into per-verse plain text.
 *
 * The API wraps each verse in `<verse_export ... vn="N">…</verse_export>`.
 * Inside each, we drop everything that isn't body text (footnotes, study
 * notes, headings) and collapse whitespace.
 */
function parseNltHtml(html: string): ParsedVerse[] {
  const out: ParsedVerse[] = [];
  // Match each <verse_export ... vn="N"> ... </verse_export>. The HTML can
  // span newlines and contain nested markup, so use a non-greedy body match.
  const VERSE_RE =
    /<verse_export\b[^>]*\bvn=["'](\d+)["'][^>]*>([\s\S]*?)<\/verse_export>/gi;
  let m: RegExpExecArray | null;
  while ((m = VERSE_RE.exec(html))) {
    const verse = Number.parseInt(m[1], 10);
    if (!Number.isFinite(verse)) continue;
    const plain = stripNltVerseHtml(m[2]);
    if (!plain) continue;
    out.push({
      verse,
      plain,
      tokens: [{ text: plain, strong: null }],
    });
  }
  return out;
}

function stripNltVerseHtml(inner: string): string {
  let s = inner;

  // 1. Drop NLT footnote / study-note / cross-ref blocks. These are
  //    `<span class="tn">…</span>`, `<span class="sn">…</span>` etc., and
  //    they contain nested <span class="tn-ref">. A naive non-greedy regex
  //    closes on the inner </span>, which leaks the rest of the footnote
  //    into the verse. Walk the string and strip balanced <span>…</span>
  //    pairs by class instead.
  s = stripBalancedSpansByClass(s, /\b(?:tn|sn|cf|fn)\b/);

  // 2. Drop the small <a class="a-tn">*</a> footnote markers.
  s = s.replace(
    /<a\b[^>]*\bclass=["'][^"']*\b(?:a-tn|a-sn|a-cf)\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    "",
  );

  // 3. Drop the verse-number badge and any headings.
  s = s.replace(
    /<span\b[^>]*\bclass=["'][^"']*\bvn\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
    "",
  );
  s = s.replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, "");
  s = s.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "");

  // 4. Strip remaining tags + decode the entities NLT actually emits.
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove `<span class="…X…">…</span>` regions where the class matches
 * `classRe`, honoring nested <span> pairs. Other tags are not balanced —
 * spans nest deeply enough in NLT footnotes that ignoring this would leak
 * footnote text into the verse body.
 */
function stripBalancedSpansByClass(input: string, classRe: RegExp): string {
  const OPEN = /<span\b([^>]*)>/gi;
  let out = "";
  let i = 0;
  while (i < input.length) {
    OPEN.lastIndex = i;
    const m = OPEN.exec(input);
    if (!m) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, m.index);

    const attrs = m[1] ?? "";
    const classMatch = /\bclass=["']([^"']*)["']/i.exec(attrs);
    const cls = classMatch?.[1] ?? "";
    const isTarget = classRe.test(cls);

    // Walk forward, tracking <span>/</span> depth, until we close the
    // span we just opened.
    let depth = 1;
    let j = OPEN.lastIndex;
    const SCAN = /<\/?span\b[^>]*>/gi;
    while (depth > 0) {
      SCAN.lastIndex = j;
      const next = SCAN.exec(input);
      if (!next) {
        // Malformed: bail without dropping content.
        return out + input.slice(m.index);
      }
      depth += next[0].startsWith("</") ? -1 : 1;
      j = SCAN.lastIndex;
    }

    if (!isTarget) {
      // Keep this span, but recurse into its body so nested footnote spans
      // (e.g. <span class="red"> wrapping a <span class="tn">) still get
      // stripped. `j` points just after the closing </span>.
      const openTag = input.slice(m.index, OPEN.lastIndex);
      const innerStart = OPEN.lastIndex;
      const innerEnd = j - "</span>".length;
      const innerCleaned = stripBalancedSpansByClass(
        input.slice(innerStart, innerEnd),
        classRe,
      );
      out += openTag + innerCleaned + "</span>";
    }
    // else: drop entirely.
    i = j;
  }
  return out;
}
