import { describe, expect, it } from "vitest";
import {
  buildRetrievedEntry,
  formatRetrievedBlock,
} from "@/lib/llm/retrievalContext";

// ─── RAG grounding context builder ──────────────────────────────────────────
//
// `buildRetrievedEntry` strips the BDB/Thayer HTML we fetch from
// bolls.life down to clean prose the LLM can consume, and labels it
// with the appropriate source tag (BDB for Hebrew, Thayer for Greek).
// These tests pin the invariants the generator + auditor depend on:
// we stay under the length cap, we decode the entity quirks
// bolls.life actually emits, and we flag stub entries so the pipeline
// can skip grounding rather than lie about having a source.

describe("buildRetrievedEntry — source labeling", () => {
  it("labels Hebrew Strong's with BDB", () => {
    const entry = buildRetrievedEntry("H430", "<p>Enough lexicon content here to clear the hasContent floor which is around one hundred and twenty characters total for the entry body.</p>");
    expect(entry.source).toBe("BDB");
  });

  it("labels Greek Strong's with Thayer", () => {
    const entry = buildRetrievedEntry("G3056", "<p>Enough lexicon content here to clear the hasContent floor which is around one hundred and twenty characters total for the entry body.</p>");
    expect(entry.source).toBe("Thayer");
  });
});

describe("buildRetrievedEntry — HTML stripping", () => {
  const sample = `
<h2>λόγος</h2>
<p>1. <b>a word</b>, saying, speech.</p>
<p>In <a href=S:G2316>God</a>'s &quot;word&quot;&mdash;see also <em>rhema</em>.</p>
<script>alert('xss')</script>
  `.trim();

  it("drops tags and scripts, keeps visible content", () => {
    const { text } = buildRetrievedEntry("G3056", sample);
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).not.toMatch(/alert\('xss'\)/);
    expect(text).toContain("a word");
    expect(text).toContain("saying, speech");
    expect(text).toContain("rhema");
  });

  it("decodes the entities bolls.life emits", () => {
    const { text } = buildRetrievedEntry("G3056", sample);
    expect(text).toContain('"word"');
    expect(text).toContain("—");
  });

  it("collapses anchor-style cross-references to plain text", () => {
    const { text } = buildRetrievedEntry("G3056", sample);
    expect(text).toContain("God's");
    expect(text).not.toMatch(/<a|S:G2316/);
  });
});

describe("buildRetrievedEntry — length cap and hasContent", () => {
  it("caps extremely long entries and marks them truncated", () => {
    const bloat = "α ".repeat(5000);
    const { text } = buildRetrievedEntry("G3056", `<p>${bloat}</p>`);
    // Cap is 4500 + "\n…(truncated)" tail.
    expect(text.length).toBeLessThan(5000);
    expect(text).toMatch(/truncated/);
  });

  it("flags short stub entries as not having real content", () => {
    const { hasContent } = buildRetrievedEntry("G3056", "<p>short</p>");
    expect(hasContent).toBe(false);
  });

  it("flags substantial entries as having real content", () => {
    const rich =
      "<p>" +
      "A word, saying, or account. Used in Koine Greek for both speech and " +
      "the content of speech; in philosophical contexts (Heraclitus, Stoic) " +
      "it denotes the rational principle ordering the cosmos." +
      "</p>";
    const { hasContent } = buildRetrievedEntry("G3056", rich);
    expect(hasContent).toBe(true);
  });
});

describe("formatRetrievedBlock", () => {
  it("returns an empty string when the entry is a stub", () => {
    const entry = buildRetrievedEntry("G3056", "<p>short</p>");
    expect(formatRetrievedBlock(entry)).toBe("");
  });

  it("fences the entry with a [RETRIEVED LEXICON ENTRY — <source>] tag", () => {
    const rich =
      "<p>" +
      "A word, saying, or account. Used across Koine Greek for both the " +
      "act of speech and its content; philosophical usage picks up the " +
      "sense of rational principle." +
      "</p>";
    const entry = buildRetrievedEntry("G3056", rich);
    const block = formatRetrievedBlock(entry);
    expect(block).toContain("[RETRIEVED LEXICON ENTRY — Thayer]");
    expect(block).toContain("[END RETRIEVED ENTRY]");
    expect(block).toMatch(/ground truth/i);
  });
});
