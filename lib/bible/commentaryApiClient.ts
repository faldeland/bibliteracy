import { bibleApiPath } from "./chapterApiClient";
import type { CommentaryView } from "./commentaryView";

export interface CommentaryApiResponse {
  book: string;
  chapter: number;
  sourceId: string;
  view?: CommentaryView;
  error?: string;
}

export async function fetchCommentaryChapterFromApi(
  bookId: string,
  chapter: number,
  sourceId: string,
  signal?: AbortSignal,
): Promise<CommentaryApiResponse> {
  const url = bibleApiPath(
    `/api/bible/commentary?book=${encodeURIComponent(bookId)}&chapter=${chapter}&source=${encodeURIComponent(sourceId)}`,
  );
  const res = await fetch(url, { signal, cache: "no-store" });
  const data = (await res.json()) as CommentaryApiResponse;
  if (!res.ok && !data.error) {
    throw new Error(`Commentary request failed (HTTP ${res.status}).`);
  }
  return data;
}
