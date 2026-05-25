/** localStorage key for whether the lounge stream bar is open. */
export const LOUNGE_ENABLED_KEY = "biblounge-enabled";

export function readLoungeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOUNGE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLoungeEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(LOUNGE_ENABLED_KEY, "1");
    else window.localStorage.removeItem(LOUNGE_ENABLED_KEY);
  } catch {
    /* quota / private mode */
  }
}
