import { describe, expect, it } from "vitest";
import {
  ALLOWED_SOURCE_HOSTS,
  normalizeSource,
  normalizeSources,
} from "@/lib/llm/truthRules";

// ─── normalizeSource / normalizeSources enforcement ─────────────────────────
//
// `normalizeSource` is the server-side teeth behind the scholarly
// allowlist — it drops any citation that doesn't name a trusted work,
// sanitizes URLs against `ALLOWED_SOURCE_HOSTS`, and force-classifies
// `type` to the trusted work's canonical category. These tests pin the
// behaviour the rest of the LLM pipeline depends on: what flows through
// to the UI and into the Supabase audit log.

describe("normalizeSource — trusted-work allowlist", () => {
  it("accepts a well-formed BDAG citation", () => {
    const out = normalizeSource({
      citation: "BDAG, s.v. λόγος",
      type: "lexicon",
      locus: "3rd ed., p. 600",
      url: null,
    });
    expect(out).not.toBeNull();
    expect(out?.citation).toBe("BDAG, s.v. λόγος");
    expect(out?.type).toBe("lexicon");
    expect(out?.locus).toBe("3rd ed., p. 600");
  });

  it("overwrites the type with the trusted work's canonical classification", () => {
    // Model mis-labels BHS as a "database" — we should coerce it back.
    const out = normalizeSource({
      citation: "BHS, Genesis 1:1",
      type: "database",
    });
    expect(out?.type).toBe("primary_text");
  });

  it("drops Strong's-as-lexicon", () => {
    expect(
      normalizeSource({ citation: "Strong's Concordance, G3056", type: "lexicon" }),
    ).toBeNull();
  });

  it("drops Vine's", () => {
    expect(
      normalizeSource({
        citation: "Vine's Expository Dictionary of NT Words",
        type: "lexicon",
      }),
    ).toBeNull();
  });

  it("drops a blog URL even if well-formed", () => {
    expect(
      normalizeSource({
        citation: "Some Pastor's Blog",
        type: "other",
        url: "https://pastorjohn.blog/logos",
      }),
    ).toBeNull();
  });

  it("drops entries with no citation", () => {
    expect(normalizeSource({ citation: "", type: "lexicon" })).toBeNull();
    expect(normalizeSource({ type: "lexicon" })).toBeNull();
    expect(normalizeSource(null)).toBeNull();
    expect(normalizeSource(42)).toBeNull();
  });
});

describe("normalizeSource — URL sanitization", () => {
  it("strips URLs from hosts not on the allowlist", () => {
    const out = normalizeSource({
      citation: "BDAG, s.v. λόγος",
      type: "lexicon",
      url: "https://random.example.com/word/3056",
    });
    expect(out).not.toBeNull();
    expect(out?.url).toBeNull();
  });

  it("keeps URLs from allowlisted hosts", () => {
    // Pick the first allowlisted host at random for robustness against
    // edits to ALLOWED_SOURCE_HOSTS.
    const host = ALLOWED_SOURCE_HOSTS[0];
    const out = normalizeSource({
      citation: "BDAG, s.v. λόγος",
      type: "lexicon",
      url: `https://${host}/lexicon/g3056`,
    });
    expect(out?.url).toBe(`https://${host}/lexicon/g3056`);
  });

  it("rejects non-http(s) schemes", () => {
    const host = ALLOWED_SOURCE_HOSTS[0];
    const out = normalizeSource({
      citation: "BDAG, s.v. λόγος",
      type: "lexicon",
      url: `ftp://${host}/lexicon/g3056`,
    });
    expect(out?.url).toBeNull();
  });

  it("rejects bare host + search-page URLs even on allowlisted hosts", () => {
    const host = ALLOWED_SOURCE_HOSTS[0];
    const bare = normalizeSource({
      citation: "BDAG, s.v. λόγος",
      type: "lexicon",
      url: `https://${host}/`,
    });
    expect(bare?.url).toBeNull();

    const search = normalizeSource({
      citation: "BDAG, s.v. λόγος",
      type: "lexicon",
      url: `https://${host}/search?q=logos`,
    });
    expect(search?.url).toBeNull();
  });
});

describe("normalizeSources", () => {
  it("maps + filters a mixed array, keeping only trusted entries", () => {
    const raw = [
      { citation: "BDAG, s.v. λόγος", type: "lexicon" },
      { citation: "Strong's Concordance, G3056", type: "lexicon" },
      { citation: "TDNT 4:102–114", type: "lexicon" },
      { citation: "Matthew Henry's Commentary on John 1", type: "other" },
      null,
      { citation: "HALOT 1:137, s.v. אֱלֹהִים", type: "lexicon" },
    ];
    const out = normalizeSources(raw);
    expect(out.map((s) => s.citation)).toEqual([
      "BDAG, s.v. λόγος",
      "TDNT 4:102–114",
      "HALOT 1:137, s.v. אֱלֹהִים",
    ]);
  });

  it("returns an empty array for non-array inputs", () => {
    expect(normalizeSources(undefined)).toEqual([]);
    expect(normalizeSources(null)).toEqual([]);
    expect(normalizeSources("bdag")).toEqual([]);
    expect(normalizeSources({ citation: "BDAG" })).toEqual([]);
  });
});
