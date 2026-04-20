import { describe, expect, it } from "vitest";
import { formatDuration, verseKey } from "@/lib/study/verseSessions";

// ─── Pure helpers ──────────────────────────────────────────────────────────
//
// The stateful runtime lives behind `window` / `localStorage` / `setInterval`
// and is covered by manual dev-server testing. The two helpers we *can*
// test deterministically are the canonical verse key builder and the
// duration formatter — both of which are on the hot path for every
// render of the indicator and every row of the history panel.

describe("verseKey", () => {
  it("composes book:chapter:verse", () => {
    expect(verseKey({ bookId: "Jhn", chapter: 3, verse: 16 })).toBe("Jhn:3:16");
    expect(verseKey({ bookId: "Gen", chapter: 1, verse: 1 })).toBe("Gen:1:1");
  });

  it("is translation-agnostic by construction (no version field)", () => {
    const a = verseKey({ bookId: "Jhn", chapter: 3, verse: 16 });
    const b = verseKey({ bookId: "Jhn", chapter: 3, verse: 16 });
    expect(a).toBe(b);
  });
});

describe("formatDuration", () => {
  it("renders sub-minute as 0:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(999)).toBe("0:00");
    expect(formatDuration(1_000)).toBe("0:01");
    expect(formatDuration(59_000)).toBe("0:59");
  });

  it("renders minutes as m:ss with two-digit seconds", () => {
    expect(formatDuration(60_000)).toBe("1:00");
    expect(formatDuration(90_000)).toBe("1:30");
    expect(formatDuration(10 * 60_000 + 5_000)).toBe("10:05");
    expect(formatDuration(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("promotes to h:mm:ss at the hour mark", () => {
    expect(formatDuration(60 * 60_000)).toBe("1:00:00");
    expect(formatDuration(60 * 60_000 + 5_000)).toBe("1:00:05");
    expect(formatDuration(2 * 60 * 60_000 + 34 * 60_000 + 56_000)).toBe(
      "2:34:56",
    );
  });

  it("treats negative input as 0 (defensive)", () => {
    expect(formatDuration(-1)).toBe("0:00");
    expect(formatDuration(-123_456)).toBe("0:00");
  });
});
