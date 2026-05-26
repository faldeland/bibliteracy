import {
  LOUNGE_TILE_HEIGHT_DEFAULT_PX,
  clampLoungeTileHeight,
} from "@/lib/lounge/loungeBarLayout";

export const LOUNGE_TILE_HEIGHT_KEY = "bibliteracy:lounge:tileHeight";

export function readStoredLoungeTileHeight(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOUNGE_TILE_HEIGHT_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clampLoungeTileHeight(n) : null;
}

export { LOUNGE_TILE_HEIGHT_DEFAULT_PX, clampLoungeTileHeight };
