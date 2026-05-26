/** Layout tokens for the lounge stream bar and participant tiles. */

export const LOUNGE_TILE_HEIGHT_DEFAULT_PX = 88;

/** 3:2 tiles (132×88 at default). */
export const LOUNGE_TILE_ASPECT = 3 / 2;

export const LOUNGE_TILE_MIN_PX = 56;

export const LOUNGE_TILE_MAX_PX = 200;

/** Toolbar row (h-8). */
export const LOUNGE_TOOLBAR_HEIGHT_PX = 32;

/** Vertical padding around the video row. */
export const LOUNGE_VIDEO_ROW_PAD_PX = 8;

/** Buffer for mic/cam toggles and optional device dropdowns in the bar. */
export const LOUNGE_CONTROL_CHROME_PX = 20;

/** Drag handle at the bottom of the stream bar. */
export const LOUNGE_RESIZE_HANDLE_PX = 6;

/** Fixed chrome excluding tile height (toolbar + padding + controls + handle). */
export const LOUNGE_BAR_CHROME_PX =
  LOUNGE_TOOLBAR_HEIGHT_PX +
  LOUNGE_VIDEO_ROW_PAD_PX +
  LOUNGE_CONTROL_CHROME_PX +
  LOUNGE_RESIZE_HANDLE_PX;

export function loungeTileWidthPx(tileHeightPx: number): number {
  return Math.round(tileHeightPx * LOUNGE_TILE_ASPECT);
}

export function loungeBarHeightPx(tileHeightPx: number): number {
  return LOUNGE_BAR_CHROME_PX + tileHeightPx;
}

export function clampLoungeTileHeight(px: number): number {
  return Math.round(
    Math.min(LOUNGE_TILE_MAX_PX, Math.max(LOUNGE_TILE_MIN_PX, px)),
  );
}
