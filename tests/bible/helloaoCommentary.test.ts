import { describe, expect, it } from "vitest";
import { flattenHelloaoContent } from "@/lib/bible/helloaoCommentary";
import { commentaryVersesInRange } from "@/lib/bible/commentaryView";

describe("helloaoCommentary", () => {
  it("flattens strings and formatted text", () => {
    expect(flattenHelloaoContent("hello")).toBe("hello");
    expect(
      flattenHelloaoContent([
        "a",
        { text: "b", format: "italic" },
        { content: ["c"] },
      ]),
    ).toBe("abc");
  });

  it("selects verses in range from normalized list", () => {
    const verses = [
      { verse: 1, text: "One" },
      { verse: 2, text: "Two" },
      { verse: 3, text: "Three" },
    ];
    expect(commentaryVersesInRange(verses, 2, 3)).toEqual([
      { verse: 2, text: "Two" },
      { verse: 3, text: "Three" },
    ]);
  });
});
