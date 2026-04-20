import { describe, expect, it } from "vitest";
import {
  PROHIBITED_SOURCES,
  TRUSTED_WORKS,
  matchTrustedWork,
} from "@/lib/llm/trustedSources";

// ─── Unit tests for the scholarly allowlist ─────────────────────────────────
//
// The matcher is the keystone of the citation-enforcement pipeline. Every
// `sources` entry that survives into the UI and into the Supabase audit
// log had to pass `matchTrustedWork`. These tests pin the behaviour we
// rely on:
//   • positive cases cover the realistic forms scholars actually type
//     (abbreviation, "s.v. <lemma>", editor surnames, full titles);
//   • negative cases cover the non-authoritative categories we call out
//     in the prohibited list (Strong's, Vine's, study Bibles, blogs,
//     ChatGPT, Bible apps, Wikipedia).

describe("matchTrustedWork — positive cases", () => {
  const cases: Array<{ citation: string; expect: string }> = [
    { citation: "BDAG, s.v. λόγος", expect: "bdag" },
    { citation: "Bauer, Danker, Arndt, Gingrich (3rd ed., 2000)", expect: "bdag" },
    { citation: "HALOT 1:137, s.v. אֱלֹהִים", expect: "halot" },
    { citation: "Koehler-Baumgartner, Hebrew Lexicon", expect: "halot" },
    { citation: "BDB, s.v. רֵאשִׁית", expect: "bdb" },
    { citation: "Brown, Driver, and Briggs, A Hebrew and English Lexicon", expect: "bdb" },
    { citation: "TDNT 4:102–114", expect: "tdnt" },
    { citation: "Kittel and Friedrich, Theological Dictionary of the New Testament", expect: "tdnt" },
    { citation: "LSJ, s.v. λόγος", expect: "lsj" },
    { citation: "Liddell-Scott-Jones", expect: "lsj" },
    { citation: "Louw-Nida 33.98", expect: "louw-nida" },
    { citation: "TDOT vol. 1, pp. 50–55", expect: "tdot" },
    { citation: "Holladay, Concise Hebrew and Aramaic Lexicon", expect: "holladay" },
    { citation: "Thayer's Greek Lexicon, s.v. λόγος", expect: "thayer" },
    { citation: "Moulton-Milligan, Vocabulary of the Greek Testament", expect: "moulton-milligan" },
    { citation: "Wallace, Greek Grammar Beyond the Basics, pp. 388–389", expect: "wallace-ggbb" },
    { citation: "GKC §74", expect: "gkc" },
    { citation: "BDF §337", expect: "bdf" },
    { citation: "Jastrow, Dictionary of the Targumim", expect: "jastrow" },
    { citation: "NA28, Matt 5:3", expect: "na28" },
    { citation: "BHS, Genesis 1:1", expect: "bhs" },
    { citation: "Rahlfs LXX, Psalm 50:19", expect: "rahlfs-lxx" },
    { citation: "Muraoka, A Greek-English Lexicon of the Septuagint", expect: "muraoka-lxx" },
  ];

  for (const { citation, expect: expected } of cases) {
    it(`matches "${citation}"`, () => {
      const work = matchTrustedWork(citation);
      expect(work).not.toBeNull();
      expect(work?.id).toBe(expected);
    });
  }
});

describe("matchTrustedWork — negative cases (prohibited / non-authoritative)", () => {
  const nonTrusted = [
    "Strong's Concordance, #3056",
    "Vine's Expository Dictionary of New Testament Words",
    "ESV Study Bible, note on John 1:1",
    "NIV Study Bible footnote",
    "Matthew Henry's Commentary",
    "Jamieson-Fausset-Brown, Genesis 1",
    "a Pastor's blog post from 2017",
    "Wikipedia: Logos (philosophy)",
    "Wiktionary, λόγος",
    "Logos Bible Software search results",
    "Olive Tree reader notes",
    "ChatGPT, personal conversation",
    "Blue Letter Bible concordance",
    "Bible Hub interlinear",
    "ESV translation footnote",
    "", // empty must not match
    "   ", // whitespace must not match
  ];

  for (const citation of nonTrusted) {
    it(`rejects ${JSON.stringify(citation)}`, () => {
      expect(matchTrustedWork(citation)).toBeNull();
    });
  }
});

describe("trusted-works inventory sanity", () => {
  it("every work has a non-empty id, abbrev, title, editors, and at least one pattern", () => {
    for (const w of TRUSTED_WORKS) {
      expect(w.id.length).toBeGreaterThan(0);
      expect(w.abbrev.length).toBeGreaterThan(0);
      expect(w.title.length).toBeGreaterThan(0);
      expect(w.editors.length).toBeGreaterThan(0);
      expect(w.patterns.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique", () => {
    const ids = TRUSTED_WORKS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("PROHIBITED_SOURCES names at least the biggest offenders the prompt calls out", () => {
    const joined = PROHIBITED_SOURCES.map((p) => p.name.toLowerCase()).join(" | ");
    expect(joined).toMatch(/strong['’]s/);
    expect(joined).toMatch(/vine['’]s/);
    expect(joined).toMatch(/study bible/);
    expect(joined).toMatch(/blog/);
    expect(joined).toMatch(/wikipedia/);
    expect(joined).toMatch(/ai|chatgpt|llm/);
  });
});
