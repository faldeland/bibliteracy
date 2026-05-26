/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  GRID_TAB_LAYOUT_STORAGE_KEY,
  applyTabDrop,
  parseGridTabLayout,
  readGridTabLayoutFromStorage,
  writeGridTabLayoutToStorage,
  type GridTabLayout,
} from "@/lib/grid/gridTabLayout";

describe("gridTabLayout", () => {
  afterEach(() => {
    window.localStorage.removeItem(GRID_TAB_LAYOUT_STORAGE_KEY);
  });

  it("applyTabDrop reorders within a pane", () => {
    const layout: GridTabLayout = {
      left: ["journal"],
      right: ["commentary", "strongs"],
    };
    expect(
      applyTabDrop(layout, "strongs", "right", 0),
    ).toEqual({
      left: ["journal"],
      right: ["strongs", "commentary"],
    });
  });

  it("applyTabDrop moves between panes", () => {
    const layout: GridTabLayout = {
      left: ["journal"],
      right: ["commentary", "strongs"],
    };
    expect(
      applyTabDrop(layout, "commentary", "left", 1),
    ).toEqual({
      left: ["journal", "commentary"],
      right: ["strongs"],
    });
  });

  it("parseGridTabLayout rejects unknown or duplicate ids", () => {
    expect(parseGridTabLayout({ left: ["journal"], right: ["journal"] })).toBeNull();
    expect(parseGridTabLayout({ left: ["nope"], right: [] })).toBeNull();
    expect(
      parseGridTabLayout({
        left: ["journal"],
        right: ["commentary"],
      }),
    ).toBeNull();
  });

  it("parseGridTabLayout accepts a valid layout", () => {
    expect(
      parseGridTabLayout({
        left: ["strongs", "journal"],
        right: ["commentary"],
      }),
    ).toEqual({
      left: ["strongs", "journal"],
      right: ["commentary"],
    });
  });

  it("round-trips via localStorage", () => {
    writeGridTabLayoutToStorage({
      left: ["journal", "strongs"],
      right: ["commentary"],
    });
    expect(readGridTabLayoutFromStorage()).toEqual({
      left: ["journal", "strongs"],
      right: ["commentary"],
    });
  });
});
