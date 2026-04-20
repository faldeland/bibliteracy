import { describe, expect, it } from "vitest";
import { COLOR_PICKER_FALLBACK, toHexOrDefault } from "@/lib/grid/color";

describe("toHexOrDefault", () => {
  it("passes through a valid 6-digit hex (lowercased)", () => {
    expect(toHexOrDefault("#AABBCC")).toBe("#aabbcc");
  });

  it("expands shorthand #rgb into #rrggbb", () => {
    expect(toHexOrDefault("#abc")).toBe("#aabbcc");
  });

  it("falls back to the default for non-hex values", () => {
    // Named colors, `rgb()`, CSS vars, etc. aren't accepted by
    // <input type="color">, so we swap in a neutral hex so the picker still
    // renders sensibly instead of snapping to black.
    expect(toHexOrDefault("tomato")).toBe(COLOR_PICKER_FALLBACK);
    expect(toHexOrDefault("rgb(255, 0, 0)")).toBe(COLOR_PICKER_FALLBACK);
    expect(toHexOrDefault("var(--color-logos)")).toBe(COLOR_PICKER_FALLBACK);
  });

  it("falls back to the default for null/undefined/empty", () => {
    expect(toHexOrDefault(null)).toBe(COLOR_PICKER_FALLBACK);
    expect(toHexOrDefault(undefined)).toBe(COLOR_PICKER_FALLBACK);
    expect(toHexOrDefault("")).toBe(COLOR_PICKER_FALLBACK);
  });
});
