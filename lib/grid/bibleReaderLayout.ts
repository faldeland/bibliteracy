/** Layout tokens for the BibleReader passage + KJV panels. */

export const BIBLE_READER_META_HEIGHT_PX = 28;

/** Max height for leading-context verses before scrolling (no minimum). */
export const BIBLE_READER_CONTEXT_MAX_HEIGHT_PX = 56;

/** Default active-verse row when no custom panel height is set. */
export const BIBLE_READER_ACTIVE_VERSE_DEFAULT_PX = 104;

/** Vertical padding on the passage panel (pt-2 + pb-3). */
export const BIBLE_READER_PANEL_PAD_Y_PX = 20;

/** Drag handle at the bottom of each resizable reader panel. */
export const BIBLE_READER_RESIZE_HANDLE_PX = 6;

/** KJV label row inside the Strong's panel. */
export const BIBLE_READER_KJV_LABEL_PX = 18;

/** Fixed chrome inside the passage panel (meta + padding + handle). */
export const BIBLE_READER_PASSAGE_CHROME_PX =
  BIBLE_READER_META_HEIGHT_PX +
  BIBLE_READER_PANEL_PAD_Y_PX +
  BIBLE_READER_RESIZE_HANDLE_PX;

/** Fixed chrome inside the KJV panel (label + padding + handle). */
export const BIBLE_READER_KJV_CHROME_PX =
  BIBLE_READER_KJV_LABEL_PX +
  BIBLE_READER_PANEL_PAD_Y_PX +
  BIBLE_READER_RESIZE_HANDLE_PX;

export const BIBLE_READER_PASSAGE_DEFAULT_PX =
  BIBLE_READER_PASSAGE_CHROME_PX + BIBLE_READER_ACTIVE_VERSE_DEFAULT_PX;

export const BIBLE_READER_PASSAGE_MIN_PX =
  BIBLE_READER_PASSAGE_CHROME_PX + 48;

export const BIBLE_READER_PASSAGE_MAX_PX = 480;

export const BIBLE_READER_KJV_DEFAULT_PX =
  BIBLE_READER_KJV_CHROME_PX + BIBLE_READER_ACTIVE_VERSE_DEFAULT_PX;

export const BIBLE_READER_KJV_MIN_PX = BIBLE_READER_KJV_CHROME_PX + 48;

export const BIBLE_READER_KJV_MAX_PX = 320;

/** Locks an element to an exact pixel height in flex layouts. */
export function fixedHeightStyle(heightPx: number): {
  height: number;
  minHeight: number;
  maxHeight: number;
  flexShrink: number;
} {
  return {
    height: heightPx,
    minHeight: heightPx,
    maxHeight: heightPx,
    flexShrink: 0,
  };
}

export function clampPassagePanelHeight(px: number): number {
  return Math.round(
    Math.min(
      BIBLE_READER_PASSAGE_MAX_PX,
      Math.max(BIBLE_READER_PASSAGE_MIN_PX, px),
    ),
  );
}

export function clampKjvPanelHeight(px: number): number {
  return Math.round(
    Math.min(BIBLE_READER_KJV_MAX_PX, Math.max(BIBLE_READER_KJV_MIN_PX, px)),
  );
}

/** Active-verse area inside a passage panel of the given outer height. */
export function passageActiveVerseHeightPx(panelHeightPx: number): number {
  return Math.max(48, panelHeightPx - BIBLE_READER_PASSAGE_CHROME_PX);
}

/** Interlinear track inside a KJV panel of the given outer height. */
export function kjvInterlinearHeightPx(panelHeightPx: number): number {
  return Math.max(48, panelHeightPx - BIBLE_READER_KJV_CHROME_PX);
}
