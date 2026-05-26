import { describe, expect, it } from "vitest";
import {
  LOUNGE_BAR_CHROME_PX,
  LOUNGE_TILE_HEIGHT_DEFAULT_PX,
  clampLoungeTileHeight,
  loungeBarHeightPx,
  loungeTileWidthPx,
} from "@/lib/lounge/loungeBarLayout";

describe("loungeBarLayout", () => {
  it("derives bar height from tile height", () => {
    expect(loungeBarHeightPx(LOUNGE_TILE_HEIGHT_DEFAULT_PX)).toBe(
      LOUNGE_BAR_CHROME_PX + LOUNGE_TILE_HEIGHT_DEFAULT_PX,
    );
  });

  it("keeps 3:2 tile width", () => {
    expect(loungeTileWidthPx(88)).toBe(132);
    expect(loungeTileWidthPx(100)).toBe(150);
  });

  it("clamps tile height", () => {
    expect(clampLoungeTileHeight(40)).toBe(56);
    expect(clampLoungeTileHeight(300)).toBe(200);
    expect(clampLoungeTileHeight(88)).toBe(88);
  });
});
