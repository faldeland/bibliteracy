/** Vertical inset from band bottom — xref spokes and active-verse dot. */
export const STRONGS_DOT_BASELINE_INSET = 2;

/** Vertical inset from band top — Strong's occurrence dot row. */
export const STRONGS_DOT_TOP_INSET = 2;

const DEFAULT_HIT_RADIUS_PX = 8;
const DEFAULT_VERTICAL_TOLERANCE_PX = 10;

/** Height of the pointer-hit row at the top of the strip track. */
export const STRONGS_DOT_ROW_HEIGHT_PX =
  STRONGS_DOT_TOP_INSET + DEFAULT_VERTICAL_TOLERANCE_PX + 2;

/** Y position for Strong's occurrence dots (near top of strip track). */
export function strongsVerseDotY(_trackHeightPx: number): number {
  return STRONGS_DOT_TOP_INSET;
}

/**
 * Find the verse index under `(localX, localY)` on the Strong's occurrence strip.
 * `indices` must be sorted ascending (canon order). `xOf` maps global verse index
 * to pixel x (e.g. `makeXMapper`).
 */
export function hitTestStrongsVerseDot(
  localX: number,
  localY: number,
  width: number,
  height: number,
  indices: Uint32Array,
  xOf: (idx: number) => number,
  options?: { hitRadiusPx?: number; verticalTolerancePx?: number },
): number | null {
  if (indices.length === 0 || width <= 0 || height <= 0) return null;

  const hitRadius = options?.hitRadiusPx ?? DEFAULT_HIT_RADIUS_PX;
  const verticalTol =
    options?.verticalTolerancePx ?? DEFAULT_VERTICAL_TOLERANCE_PX;
  const dotY = strongsVerseDotY(height);
  if (Math.abs(localY - dotY) > verticalTol) return null;

  let lo = 0;
  let hi = indices.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (xOf(indices[mid]!) < localX) lo = mid + 1;
    else hi = mid;
  }

  let best: number | null = null;
  let bestDist = hitRadius;
  for (const i of [lo - 1, lo, lo + 1]) {
    if (i < 0 || i >= indices.length) continue;
    const verseIdx = indices[i]!;
    const d = Math.abs(xOf(verseIdx) - localX);
    if (d < bestDist) {
      bestDist = d;
      best = verseIdx;
    }
  }
  return best;
}
