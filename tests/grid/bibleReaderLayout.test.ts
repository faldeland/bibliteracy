import { describe, expect, it } from "vitest";
import {
  BIBLE_READER_KJV_DEFAULT_PX,
  BIBLE_READER_PASSAGE_CHROME_PX,
  BIBLE_READER_PASSAGE_DEFAULT_PX,
  BIBLE_READER_PASSAGE_MIN_PX,
  clampKjvPanelHeight,
  clampPassagePanelHeight,
  fixedHeightStyle,
  kjvInterlinearHeightPx,
  passageActiveVerseHeightPx,
} from "@/lib/grid/bibleReaderLayout";

describe("bibleReaderLayout", () => {
  it("default passage height fits chrome plus active verse", () => {
    expect(
      passageActiveVerseHeightPx(BIBLE_READER_PASSAGE_DEFAULT_PX),
    ).toBeGreaterThanOrEqual(48);
    expect(
      BIBLE_READER_PASSAGE_DEFAULT_PX - BIBLE_READER_PASSAGE_CHROME_PX,
    ).toBe(passageActiveVerseHeightPx(BIBLE_READER_PASSAGE_DEFAULT_PX));
  });

  it("clamps passage and KJV panel heights", () => {
    expect(clampPassagePanelHeight(10)).toBe(BIBLE_READER_PASSAGE_MIN_PX);
    expect(clampKjvPanelHeight(10_000)).toBeLessThanOrEqual(320);
  });

  it("kjv interlinear track subtracts chrome", () => {
    expect(kjvInterlinearHeightPx(BIBLE_READER_KJV_DEFAULT_PX)).toBeGreaterThan(
      48,
    );
  });

  it("fixedHeightStyle locks all three dimensions", () => {
    expect(fixedHeightStyle(100)).toEqual({
      height: 100,
      minHeight: 100,
      maxHeight: 100,
      flexShrink: 0,
    });
  });
});
