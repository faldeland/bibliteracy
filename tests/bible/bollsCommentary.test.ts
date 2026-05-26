import { describe, expect, it } from "vitest";
import { bollsCommentHtmlToPlain } from "@/lib/bible/bollsCommentary";
import { commentaryVersesInRange } from "@/lib/bible/commentaryView";

describe("bollsCommentary", () => {
  it("strips HTML and preserves line breaks", () => {
    const html =
      "tn Note here.<br>See <a href='/NET/43/1/13'>1:13</a><br>Or <i>from above</i>";
    const plain = bollsCommentHtmlToPlain(html);
    expect(plain).toContain("tn Note here.");
    expect(plain).toContain("1:13");
    expect(plain).toContain("from above");
    expect(plain).not.toContain("<");
  });
});

describe("commentaryVersesInRange", () => {
  it("filters verse list", () => {
    const verses = [
      { verse: 1, text: "a" },
      { verse: 2, text: "b" },
      { verse: 3, text: "c" },
    ];
    expect(commentaryVersesInRange(verses, 2, 3)).toEqual([
      { verse: 2, text: "b" },
      { verse: 3, text: "c" },
    ]);
  });
});
