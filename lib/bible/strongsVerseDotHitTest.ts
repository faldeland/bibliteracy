/** Vertical inset from band bottom — matches StrongsVerseDots baseline. */
export const STRONGS_DOT_BASELINE_INSET = 2;

const DEFAULT_HIT_RADIUS_PX = 8;
const DEFAULT_VERTICAL_TOLERANCE_PX = 10;

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
  const baseline = height - STRONGS_DOT_BASELINE_INSET;
  if (Math.abs(localY - baseline) > verticalTol) return null;

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
