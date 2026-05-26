/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  GRID_SPLIT_COOKIE,
  GRID_SPLIT_DEFAULT_PCT,
  clampGridSplitPct,
  readGridSplitPctFromCookie,
  writeGridSplitCookie,
} from "@/lib/grid/gridSplitCookie";

describe("gridSplitCookie", () => {
  afterEach(() => {
    document.cookie = `${GRID_SPLIT_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("clamps to 15–85", () => {
    expect(clampGridSplitPct(0)).toBe(15);
    expect(clampGridSplitPct(100)).toBe(85);
    expect(clampGridSplitPct(50)).toBe(50);
    expect(clampGridSplitPct(Number.NaN)).toBe(GRID_SPLIT_DEFAULT_PCT);
  });

  it("round-trips via document.cookie", () => {
    writeGridSplitCookie(62.7);
    expect(readGridSplitPctFromCookie()).toBe(63);
  });

  it("returns null when cookie is absent", () => {
    expect(readGridSplitPctFromCookie()).toBeNull();
  });
});
