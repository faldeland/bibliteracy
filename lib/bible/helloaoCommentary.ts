import { helloaoBookId } from "./helloaoBookId";

/** @deprecated Use `HELLOAO_JFB_SOURCE_ID` from `commentarySources.ts`. */
export const DEFAULT_HELLOAO_COMMENTARY_ID = "jamieson-fausset-brown";

const HELLOAO_API = "https://bible.helloao.org/api";

export interface HelloaoCommentaryMeta {
  id: string;
  name: string;
  englishName?: string;
  website?: string;
  licenseUrl?: string;
}

export interface HelloaoCommentaryChapter {
  commentary: HelloaoCommentaryMeta;
  book: { id: string; name: string; commonName?: string };
  chapter: {
    number: number;
    introduction?: string;
    content: HelloaoChapterContent[];
  };
}

export type HelloaoChapterContent =
  | { type: "verse"; number: number; content: unknown[] }
  | { type: string; content?: unknown[]; number?: number };

export function helloaoCommentaryChapterUrl(
  commentaryId: string,
  bookId: string,
  chapter: number,
): string {
  const book = helloaoBookId(bookId);
  return `${HELLOAO_API}/c/${encodeURIComponent(commentaryId)}/${encodeURIComponent(book)}/${chapter}.json`;
}

/** Flatten helloao verse content (strings, formatted text, footnotes). */
export function flattenHelloaoContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(flattenHelloaoContent).join("");
  }
  if (content && typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.content)) return flattenHelloaoContent(o.content);
  }
  return "";
}

export async function fetchHelloaoCommentaryChapter(
  commentaryId: string,
  bookId: string,
  chapter: number,
  signal?: AbortSignal,
): Promise<HelloaoCommentaryChapter> {
  const url = helloaoCommentaryChapterUrl(commentaryId, bookId, chapter);
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Commentary request failed (HTTP ${res.status}) for ${commentaryId} ${bookId} ${chapter}.`,
    );
  }
  return (await res.json()) as HelloaoCommentaryChapter;
}
