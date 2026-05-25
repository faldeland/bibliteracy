// Shared x-axis mapping for bible-wide visualizations (cross-ref arcs,
// Strong's occurrence dots, etc.). Matches BooksLane word proportions when
// mode is "word"; verse-uniform mode matches the Harrison poster layout.

import { BIBLE_BOOKS } from "./books";
import { TOTAL_VERSES, bookRange } from "./globalVerseIndex";

export type XAxisMode = "verse" | "word";

export function makeXMapper(
  width: number,
  mode: XAxisMode,
): (idx: number) => number {
  if (mode === "verse") {
    return (idx: number) => (idx / TOTAL_VERSES) * width;
  }
  const totalWords = BIBLE_BOOKS.reduce((s, b) => s + b.words, 0);
  type Slice = { start: number; end: number; xStart: number; xEnd: number };
  const slices: Slice[] = [];
  let xCursor = 0;
  for (const b of BIBLE_BOOKS) {
    const r = bookRange(b.id);
    if (!r) continue;
    const w = (b.words / totalWords) * width;
    slices.push({ start: r.start, end: r.end, xStart: xCursor, xEnd: xCursor + w });
    xCursor += w;
  }
  return (idx: number) => {
    for (const s of slices) {
      if (idx < s.end) {
        const t = (idx - s.start) / (s.end - s.start);
        return s.xStart + t * (s.xEnd - s.xStart);
      }
    }
    return width;
  };
}
