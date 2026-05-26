/** Normalized commentary payload for the commentary panel. */
export interface CommentaryView {
  sourceId: string;
  sourceName: string;
  attributionLabel: string;
  attributionUrl: string;
  chapterIntroduction?: string;
  verses: { verse: number; text: string }[];
}

export function commentaryVersesInRange(
  verses: { verse: number; text: string }[],
  verseStart: number,
  verseEnd: number,
): { verse: number; text: string }[] {
  const lo = Math.min(verseStart, verseEnd);
  const hi = Math.max(verseStart, verseEnd);
  return verses
    .filter((v) => v.verse >= lo && v.verse <= hi && v.text.trim())
    .sort((a, b) => a.verse - b.verse);
}
