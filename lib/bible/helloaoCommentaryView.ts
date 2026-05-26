import type { CommentaryView } from "./commentaryView";
import {
  flattenHelloaoContent,
  type HelloaoCommentaryChapter,
} from "./helloaoCommentary";
import type { CommentarySource } from "./commentarySources";

export function helloaoChapterToView(
  source: CommentarySource,
  chapter: HelloaoCommentaryChapter,
): CommentaryView {
  const meta = chapter.commentary;
  const verses = chapter.chapter.content
    .filter(
      (item): item is { type: "verse"; number: number; content: unknown[] } =>
        item.type === "verse" && typeof item.number === "number",
    )
    .map((item) => ({
      verse: item.number,
      text: flattenHelloaoContent(item.content).trim(),
    }))
    .filter((v) => v.text);

  return {
    sourceId: source.id,
    sourceName: meta.englishName ?? meta.name,
    attributionLabel: source.attributionLabel,
    attributionUrl: source.attributionUrl,
    chapterIntroduction: chapter.chapter.introduction?.trim() || undefined,
    verses,
  };
}
