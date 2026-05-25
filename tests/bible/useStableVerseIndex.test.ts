// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { BibleRef } from "@/lib/grid/types";
import { verseIndex } from "@/lib/bible/globalVerseIndex";
import { useStableVerseIndex } from "@/lib/bible/useStableVerseIndex";

describe("useStableVerseIndex", () => {
  it("retains the last index when bibleRef becomes null", () => {
    const jhn = verseIndex("Jhn", 3, 16)!;
    const { result, rerender } = renderHook(
      ({ ref }: { ref: BibleRef | null }) => useStableVerseIndex(ref),
      {
        initialProps: {
          ref: { book: "Jhn", chapter: 3, verseStart: 16 },
        } as { ref: BibleRef | null },
      },
    );
    expect(result.current).toBe(jhn);
    rerender({ ref: null });
    expect(result.current).toBe(jhn);
  });
});
