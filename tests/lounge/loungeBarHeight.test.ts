/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  LOUNGE_TILE_HEIGHT_KEY,
  readStoredLoungeTileHeight,
} from "@/lib/lounge/loungeBarHeight";

describe("loungeBarHeight storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads null when unset", () => {
    expect(readStoredLoungeTileHeight()).toBeNull();
  });

  it("reads clamped stored height", () => {
    localStorage.setItem(LOUNGE_TILE_HEIGHT_KEY, "120");
    expect(readStoredLoungeTileHeight()).toBe(120);
    localStorage.setItem(LOUNGE_TILE_HEIGHT_KEY, "999");
    expect(readStoredLoungeTileHeight()).toBe(200);
  });
});
