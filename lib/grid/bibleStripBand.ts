/** Label row above the baseline track in the bible-strip band above BooksLane. */
export const BIBLE_STRIP_LABEL_ROW_PX = 14;

/** Drawing area for baseline, dots, and spokes. */
export const BIBLE_STRIP_TRACK_HEIGHT_PX = 22;

/** Total fixed height for the xref band above BooksLane (not resizable). */
export const BIBLE_STRIP_BAND_HEIGHT =
  BIBLE_STRIP_LABEL_ROW_PX + BIBLE_STRIP_TRACK_HEIGHT_PX;

/** No border-b here — BibleStripActiveVerse draws the baseline at the track bottom. */
export const bibleStripBandClassName =
  "relative shrink-0 grow-0 overflow-hidden bg-[var(--color-paper-2)]/50";

/** Inline style that locks band height in flex layouts. */
export function bibleStripBandStyle(): {
  height: number;
  minHeight: number;
  maxHeight: number;
  flexShrink: 0;
} {
  return {
    height: BIBLE_STRIP_BAND_HEIGHT,
    minHeight: BIBLE_STRIP_BAND_HEIGHT,
    maxHeight: BIBLE_STRIP_BAND_HEIGHT,
    flexShrink: 0,
  };
}
