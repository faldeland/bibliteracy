/** Client cookie: left pane width as a percentage of the split row (15–85). */
export const GRID_SPLIT_COOKIE = "bibliteracy_grid_split";

export const GRID_SPLIT_DEFAULT_PCT = 50;

const MIN_PCT = 15;
const MAX_PCT = 85;

/** One year — layout preference, not auth-sensitive. */
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function clampGridSplitPct(n: number): number {
  if (!Number.isFinite(n)) return GRID_SPLIT_DEFAULT_PCT;
  return Math.min(MAX_PCT, Math.max(MIN_PCT, n));
}

export function readGridSplitPctFromCookie(): number | null {
  if (typeof document === "undefined") return null;
  const prefix = `${GRID_SPLIT_COOKIE}=`;
  const row = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  if (!row) return null;
  const raw = row.slice(prefix.length);
  const n = Number(decodeURIComponent(raw));
  return Number.isFinite(n) ? clampGridSplitPct(n) : null;
}

export function writeGridSplitCookie(pct: number): void {
  if (typeof document === "undefined") return;
  const value = String(Math.round(clampGridSplitPct(pct)));
  document.cookie = `${GRID_SPLIT_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}
