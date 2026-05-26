"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchChapterFromApi,
  type ChapterApiResponse,
} from "@/lib/bible/chapterApiClient";

/**
 * Thin react-query wrapper around `fetchChapterFromApi`. Chapters are immutable
 * within a translation, so we stale-cache them for an hour — repeated
 * cross-reference peeks on the atlas don't re-hit the network.
 */
export function useChapter(
  bookId: string | null | undefined,
  chapter: number | null | undefined,
  translationId: string,
  enabled = true,
) {
  return useQuery<ChapterApiResponse>({
    queryKey: ["bible-chapter", bookId, chapter, translationId],
    enabled: enabled && !!bookId && chapter != null,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: ({ signal }) =>
      fetchChapterFromApi(bookId!, chapter!, translationId, signal),
  });
}
