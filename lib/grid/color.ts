/**
 * Best-effort conversion of a color string into a 7-char `#rrggbb` value the
 * native `<input type="color">` accepts. Anything unrecognized (named colors,
 * `rgb()`, CSS variables, etc.) falls back to a neutral ink color so the
 * picker still renders without a jarring reset to black.
 *
 * Used by `TimelineSettingsSheet` when seeding the color picker from an
 * effective accent that may be a CSS variable (built-in lanes) or a palette
 * hex (custom lanes).
 */
export function toHexOrDefault(input: string | null | undefined): string {
  if (!input) return COLOR_PICKER_FALLBACK;
  const s = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return COLOR_PICKER_FALLBACK;
}

/** Neutral warm-ink color used when no valid hex is available. */
export const COLOR_PICKER_FALLBACK = "#8a6a2a";
