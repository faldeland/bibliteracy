/** @vitest-environment jsdom */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  BIBLE_READER_KJV_HEIGHT_KEY,
  BIBLE_READER_PASSAGE_HEIGHT_KEY,
  readStoredKjvPanelHeight,
  readStoredPassagePanelHeight,
} from "@/lib/grid/bibleReaderHeights";
import { BIBLE_READER_PASSAGE_DEFAULT_PX } from "@/lib/grid/bibleReaderLayout";

describe("bibleReaderHeights storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("reads clamped passage height from localStorage", () => {
    localStorage.setItem(BIBLE_READER_PASSAGE_HEIGHT_KEY, "300");
    expect(readStoredPassagePanelHeight()).toBe(300);
  });

  it("returns null for invalid stored values", () => {
    localStorage.setItem(BIBLE_READER_PASSAGE_HEIGHT_KEY, "nope");
    expect(readStoredPassagePanelHeight()).toBeNull();
  });

  it("reads KJV height when set", () => {
    localStorage.setItem(BIBLE_READER_KJV_HEIGHT_KEY, "180");
    expect(readStoredKjvPanelHeight()).toBe(180);
  });

  it("default passage constant matches layout module", () => {
    expect(BIBLE_READER_PASSAGE_DEFAULT_PX).toBeGreaterThan(150);
  });
});
