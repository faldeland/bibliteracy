import { bollsIdFor } from "./bollsApi";
import type { CommentarySource } from "./commentarySources";
import type { CommentaryView } from "./commentaryView";

const BASE = "https://bolls.life";

interface BollsChapterVerseRow {
  verse: number;
  comment?: string;
}

/** Turn Bolls HTML study notes into readable plain text. */
export function bollsCommentHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*href=['"][^'"]*['"][^>]*>([^<]*)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function bollsCommentaryChapterUrl(
  translationId: string,
  bollsBookId: number,
  chapter: number,
): string {
  return `${BASE}/get-chapter/${encodeURIComponent(translationId)}/${bollsBookId}/${chapter}/`;
}

export async function fetchBollsCommentaryChapter(
  bookId: string,
  chapter: number,
  source: CommentarySource,
  signal?: AbortSignal,
): Promise<CommentaryView> {
  const translationId = source.bollsTranslationId;
  if (!translationId) {
    throw new Error(`Commentary source ${source.id} has no Bolls translation.`);
  }
  const bollsBook = bollsIdFor(bookId);
  if (!bollsBook) throw new Error(`Unknown book id: ${bookId}`);

  const url = bollsCommentaryChapterUrl(translationId, bollsBook, chapter);
  const res = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `bolls.life HTTP ${res.status} for ${translationId} ${bookId} ${chapter}`,
    );
  }

  const rows = (await res.json()) as BollsChapterVerseRow[];
  const verses = rows
    .map((r) => ({
      verse: r.verse,
      text: r.comment ? bollsCommentHtmlToPlain(r.comment) : "",
    }))
    .filter((v) => v.text);

  return {
    sourceId: source.id,
    sourceName: source.label,
    attributionLabel: source.attributionLabel,
    attributionUrl: source.attributionUrl,
    verses,
  };
}
