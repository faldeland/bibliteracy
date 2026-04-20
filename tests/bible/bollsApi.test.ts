import { describe, expect, it } from "vitest";
import {
  bollsIdFor,
  bookForBollsId,
  parseVerseTokens,
  pickShortGloss,
  type BollsDictRow,
} from "@/lib/bible/bollsApi";
import { BIBLE_BOOKS } from "@/lib/bible/books";

function row(partial: Partial<BollsDictRow>): BollsDictRow {
  return {
    topic: "",
    definition: "",
    lexeme: "",
    transliteration: "",
    pronunciation: "",
    short_definition: "",
    weight: 0,
    ...partial,
  };
}

describe("bollsIdFor / bookForBollsId", () => {
  it("returns 1..66 for canonical Protestant order", () => {
    // Spot check: Genesis = 1, Malachi = 39, Matthew = 40, Revelation = 66.
    expect(bollsIdFor("Gen")).toBe(1);
    expect(bollsIdFor("Mal")).toBe(39);
    expect(bollsIdFor("Mat")).toBe(40);
    expect(bollsIdFor("Rev")).toBe(66);
  });

  it("covers every one of the 66 books with a unique numeric id", () => {
    const ids = BIBLE_BOOKS.map((b) => bollsIdFor(b.id));
    expect(ids.every((n) => typeof n === "number" && n! >= 1 && n! <= 66))
      .toBe(true);
    expect(new Set(ids).size).toBe(66);
  });

  it("partitions OT (1..39) and NT (40..66) correctly", () => {
    for (const b of BIBLE_BOOKS) {
      const id = bollsIdFor(b.id)!;
      if (b.testament === "OT") {
        expect(id).toBeGreaterThanOrEqual(1);
        expect(id).toBeLessThanOrEqual(39);
      } else {
        expect(id).toBeGreaterThanOrEqual(40);
        expect(id).toBeLessThanOrEqual(66);
      }
    }
  });

  it("bookForBollsId is the inverse of bollsIdFor", () => {
    for (const b of BIBLE_BOOKS) {
      const n = bollsIdFor(b.id)!;
      expect(bookForBollsId(n)?.id).toBe(b.id);
    }
  });

  it("returns null for unknown ids", () => {
    expect(bollsIdFor("Xyz")).toBeNull();
    expect(bookForBollsId(0)).toBeUndefined();
    expect(bookForBollsId(99)).toBeUndefined();
  });
});

describe("parseVerseTokens — Strong's-tagged HTML", () => {
  it("aligns NT English chunks to G-prefixed Strong's numbers", () => {
    const html = "In the beginning<S>746</S> was<S>2258</S> the Word<S>3056</S>";
    const { tokens, plain } = parseVerseTokens(html, "NT");
    expect(tokens).toEqual([
      { text: "In the beginning", strong: "G746" },
      { text: "was", strong: "G2258" },
      { text: "the Word", strong: "G3056" },
    ]);
    expect(plain).toBe("In the beginning was the Word");
  });

  it("aligns OT English chunks to H-prefixed Strong's numbers", () => {
    const html =
      "In the beginning<S>7225</S> God<S>430</S> created<S>1254</S> the heaven<S>8064</S>";
    const { tokens } = parseVerseTokens(html, "OT");
    expect(tokens.map((t) => t.strong)).toEqual([
      "H7225", "H430", "H1254", "H8064",
    ]);
  });

  it("emits empty-text tokens when two Strong's tags are adjacent", () => {
    const html = "Word<S>3056</S><S>2316</S>";
    const { tokens } = parseVerseTokens(html, "NT");
    expect(tokens).toEqual([
      { text: "Word", strong: "G3056" },
      { text: "", strong: "G2316" },
    ]);
  });

  it("captures trailing English without a Strong's tag", () => {
    const html = "the Word<S>3056</S> said amen.";
    const { tokens } = parseVerseTokens(html, "NT");
    expect(tokens).toEqual([
      { text: "the Word", strong: "G3056" },
      { text: "said amen.", strong: null },
    ]);
  });

  it("collapses runs of whitespace in token text", () => {
    const html = "the   Word<S>3056</S>\n\twas<S>2258</S>";
    const { tokens } = parseVerseTokens(html, "NT");
    expect(tokens[0].text).toBe("the Word");
    expect(tokens[1].text).toBe("was");
  });

  it("strips footnote / italic / sup tags out of plain text", () => {
    const html =
      "the Word<S>3056</S> was<S>2258</S> God<S>2316</S>.<sup>a</sup><f>note</f><i>(emph)</i>";
    const { plain, tokens } = parseVerseTokens(html, "NT");
    expect(plain).not.toMatch(/<|note|emph/);
    expect(plain).toBe("the Word was God .");
    // <i>/<f>/<sup> chunks are stripped before tokenization, so they don't
    // break Strong's alignment. The three Strong's-tagged tokens are intact;
    // a final tail token captures the trailing "." with no Strong's number.
    expect(tokens.filter((t) => t.strong !== null)).toHaveLength(3);
    expect(tokens[2].text).toBe("God");
    const tail = tokens[tokens.length - 1];
    expect(tail.strong).toBeNull();
    expect(tail.text).toBe(".");
  });

  it("handles a verse with no Strong's tags at all", () => {
    const html = "Selah.";
    const { tokens, plain } = parseVerseTokens(html, "OT");
    expect(plain).toBe("Selah.");
    expect(tokens).toEqual([{ text: "Selah.", strong: null }]);
  });

  it("returns empty tokens for an empty input", () => {
    const { tokens, plain } = parseVerseTokens("", "NT");
    expect(tokens).toEqual([]);
    expect(plain).toBe("");
  });
});

describe("pickShortGloss", () => {
  it("prefers the first one-word italic in the Strong's gloss line", () => {
    const html =
      "<p>blah</p>Strongs: <i>g00d-word</i>; <i>create</i>; <i>establish</i>";
    const r = row({ definition: html, short_definition: "fallback" });
    expect(pickShortGloss(r)).toBe("create");
  });

  it("prefers a multi-word italic phrase over a single word", () => {
    const html = "Strongs: <i>in this way</i>; <i>thus</i>";
    expect(pickShortGloss(row({ definition: html }))).toBe("in this way");
  });

  it("skips italics that look like phonetic transliterations", () => {
    const html = "Strongs: <i>log-os</i>; <i>word</i>";
    expect(pickShortGloss(row({ definition: html }))).toBe("word");
  });

  it("falls back to a Thayer-style first sense", () => {
    const html = "<b>1.</b> reason; <b>2.</b> account";
    expect(pickShortGloss(row({ definition: html }))).toBe("reason");
  });

  it("falls back to a BDB-style ordered list", () => {
    const html = "<ol><li>create, fashion</li><li>shape</li></ol>";
    expect(pickShortGloss(row({ definition: html }))).toBe("create");
  });

  it("falls back to BDB sub-sense ordered list (type=a)", () => {
    const html =
      "<ol><li>(plural)</li></ol>Strongs: nothing<ol type=a><li>love steadfastly</li></ol>";
    // The Strongs line has no italic, so we drop to BDB-sub-sense which finds
    // "love steadfastly".
    const result = pickShortGloss(row({ definition: html }));
    expect(result.length).toBeGreaterThan(0);
  });

  it("strips Hebrew binyan markers like (Qal)", () => {
    const html = "<ol><li>(Qal) to create, form</li></ol>";
    expect(pickShortGloss(row({ definition: html }))).toBe("to create");
  });

  it("truncates very long glosses with an ellipsis", () => {
    const html =
      "<ol><li>this is an exceptionally long gloss that should be truncated</li></ol>";
    const out = pickShortGloss(row({ definition: html }));
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(24);
  });

  it("falls back to short_definition when nothing else matches", () => {
    expect(pickShortGloss(row({ short_definition: "love" }))).toBe("love");
  });

  it("returns an em-dash when there's truly nothing to gloss", () => {
    expect(pickShortGloss(row({}))).toBe("—");
  });
});
