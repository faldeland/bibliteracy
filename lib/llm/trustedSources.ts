/**
 * Allowlist of reference works biblical scholars consider trustworthy.
 *
 * Every citation produced by an LLM call in this app must name one of the
 * works in `TRUSTED_WORKS`. Citations that don't match are stripped by
 * `normalizeSource` (see `truthRules.ts`). If stripping leaves a response
 * with zero sources, the shared pipeline promotes it to a refusal — the UI
 * hides uncorroborated content rather than displaying it.
 *
 * The list reflects the working consensus of modern biblical lexicography
 * and Greek/Hebrew grammar: the lexica, grammars, and critical editions
 * that peer-reviewed biblical scholarship routinely cites. It is NOT a
 * list of works we like or find devotionally useful — it is specifically
 * the evidentiary tier scholars treat as authoritative.
 *
 * Adding a work:
 *   1. Confirm it's cited in peer-reviewed biblical-studies journals as a
 *      primary lexical / grammatical / text-critical authority.
 *   2. Add an entry to `TRUSTED_WORKS` with at least one distinctive
 *      pattern (abbreviation, editor surnames, or title fragment).
 *   3. Re-run the live word-study tests to make sure nothing regresses.
 */

import type { SourceType } from "./truthRules";

export type Scope =
  | "hebrew-ot" // Hebrew Bible / OT
  | "aramaic" // Biblical Aramaic / Targumim
  | "greek-nt" // Greek NT
  | "greek-general" // Classical + Koine Greek broadly
  | "lxx" // Septuagint
  | "primary-text" // critical editions
  | "both"; // pan-testament theological dictionaries

export interface TrustedWork {
  id: string;
  abbrev: string;
  title: string;
  editors: string;
  year?: string;
  type: SourceType;
  scope: Scope;
  /**
   * Distinctive substrings that identify this work in a free-form
   * citation string. Matched case-insensitively against the citation;
   * any match counts. Keep patterns narrow enough to avoid cross-work
   * collisions (e.g. prefer "Brown.*Driver" over just "Brown").
   */
  patterns: RegExp[];
}

// ─── The trusted list ────────────────────────────────────────────────────────

export const TRUSTED_WORKS: TrustedWork[] = [
  // ── Greek NT lexica ────────────────────────────────────────────────────────
  {
    id: "bdag",
    abbrev: "BDAG",
    title:
      "A Greek-English Lexicon of the New Testament and Other Early Christian Literature",
    editors: "Bauer, Danker, Arndt, Gingrich",
    year: "3rd ed., 2000",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [
      /\bBDAG\b/i,
      /Bauer.{0,40}Danker/i,
      /Danker.{0,40}(Arndt|Bauer)/i,
      /A Greek-English Lexicon of the New Testament and Other Early Christian/i,
    ],
  },
  {
    id: "bauer-de",
    abbrev: "Bauer",
    title: "Griechisch-deutsches Wörterbuch (BAA)",
    editors: "Walter Bauer (ed. Aland)",
    year: "6th ed., 1988",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [/Griechisch-deutsches W[oö]rterbuch/i, /\bBAA\b/],
  },
  {
    id: "thayer",
    abbrev: "Thayer",
    title: "Greek-English Lexicon of the New Testament",
    editors: "Joseph Henry Thayer",
    year: "1889",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [/\bThayer\b/i],
  },
  {
    id: "moulton-milligan",
    abbrev: "MM",
    title: "The Vocabulary of the Greek Testament",
    editors: "Moulton, Milligan",
    year: "1930",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [
      /Moulton.{0,20}Milligan/i,
      /\bMM\b(?!\w)/,
      /Vocabulary of the Greek (New )?Testament/i,
    ],
  },
  {
    id: "tdnt",
    abbrev: "TDNT",
    title: "Theological Dictionary of the New Testament",
    editors: "Kittel, Friedrich",
    year: "10 vols., 1964–1976",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [
      /\bTDNT\b/i,
      /Kittel.{0,40}(Friedrich|Theological)/i,
      /Theological Dictionary of the New Testament/i,
    ],
  },
  {
    id: "ednt",
    abbrev: "EDNT",
    title: "Exegetical Dictionary of the New Testament",
    editors: "Balz, Schneider",
    year: "1990–1993",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [/\bEDNT\b/i, /Exegetical Dictionary of the New Testament/i],
  },
  {
    id: "louw-nida",
    abbrev: "L&N",
    title: "Greek-English Lexicon of the NT Based on Semantic Domains",
    editors: "Louw, Nida",
    year: "2nd ed., 1989",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [
      /Louw.{0,20}Nida/i,
      /\bL&N\b/i,
      /Based on Semantic Domains/i,
    ],
  },
  {
    id: "nidntte",
    abbrev: "NIDNTTE",
    title:
      "New International Dictionary of New Testament Theology and Exegesis",
    editors: "Silva",
    year: "2014",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [
      /\bNIDNTTE\b/i,
      /New International Dictionary of New Testament Theology/i,
    ],
  },
  {
    id: "spicq",
    abbrev: "TLNT",
    title: "Theological Lexicon of the New Testament",
    editors: "Ceslas Spicq",
    year: "1994",
    type: "lexicon",
    scope: "greek-nt",
    patterns: [/\bTLNT\b/i, /\bSpicq\b/i],
  },

  // ── Greek (general) lexica ────────────────────────────────────────────────
  {
    id: "lsj",
    abbrev: "LSJ",
    title: "A Greek-English Lexicon",
    editors: "Liddell, Scott, Jones",
    year: "9th ed. with suppl., 1996",
    type: "lexicon",
    scope: "greek-general",
    patterns: [
      /\bLSJ\b/i,
      /Liddell.{0,20}Scott/i,
      /Liddell[- ]Scott[- ]Jones/i,
    ],
  },
  {
    id: "middle-liddell",
    abbrev: "Middle Liddell",
    title: "An Intermediate Greek-English Lexicon",
    editors: "Liddell, Scott",
    year: "1889",
    type: "lexicon",
    scope: "greek-general",
    patterns: [/Middle Liddell/i, /Intermediate Greek-English Lexicon/i],
  },
  {
    id: "cgl",
    abbrev: "CGL",
    title: "The Cambridge Greek Lexicon",
    editors: "Diggle et al.",
    year: "2021",
    type: "lexicon",
    scope: "greek-general",
    patterns: [/Cambridge Greek Lexicon/i, /\bCGL\b/i],
  },
  {
    id: "dge",
    abbrev: "DGE",
    title: "Diccionario Griego-Español",
    editors: "Adrados et al.",
    type: "lexicon",
    scope: "greek-general",
    patterns: [/\bDGE\b/i, /Diccionario Griego-Espa[nñ]ol/i],
  },

  // ── LXX lexica ─────────────────────────────────────────────────────────────
  {
    id: "muraoka-lxx",
    abbrev: "Muraoka LXX",
    title: "A Greek-English Lexicon of the Septuagint",
    editors: "Takamitsu Muraoka",
    year: "2009",
    type: "lexicon",
    scope: "lxx",
    patterns: [/Muraoka.{0,60}Septuagint/i, /\bGELS\b/i],
  },
  {
    id: "lust-eynikel-hauspie",
    abbrev: "LEH",
    title: "A Greek-English Lexicon of the Septuagint",
    editors: "Lust, Eynikel, Hauspie",
    year: "2nd ed., 2003",
    type: "lexicon",
    scope: "lxx",
    patterns: [/\bLEH\b/i, /Lust.{0,20}Eynikel/i],
  },

  // ── Hebrew / Aramaic lexica ───────────────────────────────────────────────
  {
    id: "bdb",
    abbrev: "BDB",
    title: "A Hebrew and English Lexicon of the Old Testament",
    editors: "Brown, Driver, Briggs",
    year: "1906",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [
      /\bBDB\b/i,
      /Brown.{0,20}Driver.{0,20}Briggs/i,
      /A Hebrew and English Lexicon of the Old Testament/i,
    ],
  },
  {
    id: "halot",
    abbrev: "HALOT",
    title: "The Hebrew and Aramaic Lexicon of the Old Testament",
    editors: "Koehler, Baumgartner",
    year: "1994–2000",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [
      /\bHALOT\b/i,
      /Koehler.{0,20}Baumgartner/i,
      /Hebrew and Aramaic Lexicon of the Old Testament/i,
    ],
  },
  {
    id: "dch",
    abbrev: "DCH",
    title: "The Dictionary of Classical Hebrew",
    editors: "David J. A. Clines",
    year: "1993–2016",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [
      /\bDCH\b/i,
      /Clines.{0,40}Classical Hebrew/i,
      /Dictionary of Classical Hebrew/i,
    ],
  },
  {
    id: "gesenius-lex",
    abbrev: "Gesenius",
    title: "Gesenius' Hebrew-Chaldee Lexicon",
    editors: "Wilhelm Gesenius",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [/Gesenius['’]? Hebrew/i, /Gesenius['’]? Lexicon/i],
  },
  {
    id: "holladay",
    abbrev: "Holladay",
    title: "A Concise Hebrew and Aramaic Lexicon of the Old Testament",
    editors: "William L. Holladay",
    year: "1971",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [/\bHolladay\b/i, /Concise Hebrew and Aramaic Lexicon/i],
  },
  {
    id: "tdot",
    abbrev: "TDOT",
    title: "Theological Dictionary of the Old Testament",
    editors: "Botterweck, Ringgren, Fabry",
    year: "15 vols., 1974–2018",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [
      /\bTDOT\b/i,
      /Botterweck/i,
      /Ringgren/i,
      /Theological Dictionary of the Old Testament/i,
    ],
  },
  {
    id: "twot",
    abbrev: "TWOT",
    title: "Theological Wordbook of the Old Testament",
    editors: "Harris, Archer, Waltke",
    year: "1980",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [/\bTWOT\b/i, /Theological Wordbook of the Old Testament/i],
  },
  {
    id: "nidotte",
    abbrev: "NIDOTTE",
    title:
      "New International Dictionary of Old Testament Theology and Exegesis",
    editors: "VanGemeren",
    year: "1997",
    type: "lexicon",
    scope: "hebrew-ot",
    patterns: [
      /\bNIDOTTE\b/i,
      /New International Dictionary of Old Testament Theology/i,
    ],
  },
  {
    id: "jastrow",
    abbrev: "Jastrow",
    title:
      "A Dictionary of the Targumim, the Talmud Babli and Yerushalmi, and the Midrashic Literature",
    editors: "Marcus Jastrow",
    year: "1903",
    type: "lexicon",
    scope: "aramaic",
    patterns: [/\bJastrow\b/i, /Dictionary of the Targumim/i],
  },
  {
    id: "caljastrow-aramaic",
    abbrev: "CAL",
    title: "Comprehensive Aramaic Lexicon",
    editors: "Kaufman et al., Hebrew Union College",
    type: "lexicon",
    scope: "aramaic",
    patterns: [/\bCAL\b(?!\w)/i, /Comprehensive Aramaic Lexicon/i],
  },

  // ── Greek grammars ────────────────────────────────────────────────────────
  {
    id: "wallace-ggbb",
    abbrev: "Wallace",
    title: "Greek Grammar Beyond the Basics",
    editors: "Daniel B. Wallace",
    year: "1996",
    type: "grammar",
    scope: "greek-nt",
    patterns: [/Greek Grammar Beyond the Basics/i, /\bWallace\b.{0,40}Greek/i],
  },
  {
    id: "bdf",
    abbrev: "BDF",
    title: "A Greek Grammar of the New Testament and Other Early Christian Literature",
    editors: "Blass, Debrunner, Funk",
    year: "1961",
    type: "grammar",
    scope: "greek-nt",
    patterns: [/\bBDF\b/i, /Blass.{0,20}Debrunner/i],
  },
  {
    id: "robertson-grammar",
    abbrev: "Robertson",
    title:
      "A Grammar of the Greek New Testament in the Light of Historical Research",
    editors: "A. T. Robertson",
    year: "1934",
    type: "grammar",
    scope: "greek-nt",
    patterns: [/Robertson.{0,40}Greek New Testament/i, /\bATR\b(?!\w)/i],
  },
  {
    id: "smyth",
    abbrev: "Smyth",
    title: "Greek Grammar",
    editors: "Herbert Weir Smyth",
    year: "1920",
    type: "grammar",
    scope: "greek-general",
    patterns: [/Smyth.{0,30}Greek Grammar/i],
  },

  // ── Hebrew grammars ───────────────────────────────────────────────────────
  {
    id: "gkc",
    abbrev: "GKC",
    title: "Gesenius' Hebrew Grammar",
    editors: "Gesenius, Kautzsch, Cowley",
    year: "2nd Eng. ed., 1910",
    type: "grammar",
    scope: "hebrew-ot",
    patterns: [
      /\bGKC\b/i,
      /Gesenius.{0,20}Kautzsch/i,
      /Gesenius['’]? Hebrew Grammar/i,
    ],
  },
  {
    id: "jouon-muraoka",
    abbrev: "Joüon-Muraoka",
    title: "A Grammar of Biblical Hebrew",
    editors: "Joüon, Muraoka",
    year: "2nd ed., 2006",
    type: "grammar",
    scope: "hebrew-ot",
    patterns: [/Jo[uü]on.{0,20}Muraoka/i, /A Grammar of Biblical Hebrew/i],
  },
  {
    id: "waltke-oconnor",
    abbrev: "Waltke-O'Connor",
    title: "An Introduction to Biblical Hebrew Syntax",
    editors: "Waltke, O'Connor",
    year: "1990",
    type: "grammar",
    scope: "hebrew-ot",
    patterns: [
      /Waltke.{0,20}O['’]?Connor/i,
      /Introduction to Biblical Hebrew Syntax/i,
    ],
  },
  {
    id: "vdm-naude-kroeze",
    abbrev: "BHRG",
    title: "A Biblical Hebrew Reference Grammar",
    editors: "van der Merwe, Naudé, Kroeze",
    year: "2nd ed., 2017",
    type: "grammar",
    scope: "hebrew-ot",
    patterns: [/\bBHRG\b/i, /van der Merwe/i],
  },

  // ── Critical editions (primary texts) ─────────────────────────────────────
  {
    id: "bhs",
    abbrev: "BHS",
    title: "Biblia Hebraica Stuttgartensia",
    editors: "Elliger, Rudolph",
    year: "5th ed., 1997",
    type: "primary_text",
    scope: "primary-text",
    patterns: [/\bBHS\b/i, /Biblia Hebraica Stuttgartensia/i],
  },
  {
    id: "bhq",
    abbrev: "BHQ",
    title: "Biblia Hebraica Quinta",
    editors: "Schenker et al.",
    type: "primary_text",
    scope: "primary-text",
    patterns: [/\bBHQ\b/i, /Biblia Hebraica Quinta/i],
  },
  {
    id: "na28",
    abbrev: "NA28",
    title: "Novum Testamentum Graece (Nestle-Aland)",
    editors: "Aland et al.",
    year: "28th ed., 2012",
    type: "primary_text",
    scope: "primary-text",
    patterns: [/\bNA\s?2[89]\b/i, /Nestle[- ]Aland/i, /Novum Testamentum Graece/i],
  },
  {
    id: "ubs5",
    abbrev: "UBS5",
    title: "The Greek New Testament (UBS)",
    editors: "United Bible Societies",
    year: "5th ed., 2014",
    type: "primary_text",
    scope: "primary-text",
    patterns: [/\bUBS\s?[45]\b/i, /UBS Greek New Testament/i],
  },
  {
    id: "rahlfs-lxx",
    abbrev: "Rahlfs LXX",
    title: "Septuaginta",
    editors: "Rahlfs, Hanhart",
    year: "rev. ed., 2006",
    type: "primary_text",
    scope: "primary-text",
    patterns: [/\bRahlfs\b/i],
  },
  {
    id: "goettingen-lxx",
    abbrev: "Göttingen LXX",
    title: "Septuaginta: Vetus Testamentum Graecum",
    editors: "Göttingen Septuagint Project",
    type: "primary_text",
    scope: "primary-text",
    patterns: [/G[oö]ttingen.{0,20}(Septuagint|LXX)/i],
  },
];

// ─── Explicitly prohibited sources ──────────────────────────────────────────
//
// These are either non-authoritative (devotional, outdated, or not a
// scholarly source at all) or are fundamentally unverifiable (personal
// blogs, AI output). The model is told to never cite these. We don't run
// a "reject" pass on them explicitly — the trusted-matcher approach means
// anything not on TRUSTED_WORKS is already dropped — but naming them in
// the system prompt measurably reduces the odds that the model even
// reaches for them.

export const PROHIBITED_SOURCES: Array<{ name: string; reason: string }> = [
  {
    name: "Strong's Concordance (as a lexical authority)",
    reason:
      "An 1890 index; its glosses are not a scholarly lexicon. Cite the underlying lexicon (BDB, BDAG, etc.) instead.",
  },
  {
    name: "Vine's Expository Dictionary of New Testament Words",
    reason:
      "Devotional reference; scholars do not treat it as a current lexical authority.",
  },
  {
    name: "Study Bible notes (ESV Study Bible, NIV Study Bible, etc.)",
    reason: "Editorial notes, not lexical scholarship.",
  },
  {
    name: "Devotional commentaries (Matthew Henry, JFB, Barnes, etc.)",
    reason: "Homiletical, not lexicographic.",
  },
  {
    name: "Personal blogs, sermon manuscripts, ministry websites",
    reason: "Not peer-reviewed; unverifiable.",
  },
  {
    name: "Wikipedia / Wiktionary as a primary lexical source",
    reason:
      "Useful for orientation only; cite the underlying scholarly work it summarizes.",
  },
  {
    name: "Bible-study software platforms (Logos, Accordance, Olive Tree)",
    reason:
      "Distribution channels, not sources. Cite the licensed lexicon itself (e.g. BDAG, HALOT) rather than the app.",
  },
  {
    name: "AI-generated content, ChatGPT, or other LLM-authored material",
    reason: "Self-referential; not a source of ground truth.",
  },
  {
    name: "Translation committee footnotes as lexical authority",
    reason:
      "A translation decision is not a lexicon entry. Cite the lexicon that informed it.",
  },
];

// ─── Matcher ─────────────────────────────────────────────────────────────────

/**
 * Return the trusted work identified by a free-form citation string, or
 * null if nothing on `TRUSTED_WORKS` matches. First match wins, so order
 * matters for near-duplicates (BDAG before plain "Bauer", LSJ before
 * "Middle Liddell" etc.) — the list above is ordered intentionally.
 */
export function matchTrustedWork(citation: string): TrustedWork | null {
  if (typeof citation !== "string" || citation.length === 0) return null;
  for (const w of TRUSTED_WORKS) {
    for (const p of w.patterns) {
      if (p.test(citation)) return w;
    }
  }
  return null;
}

// ─── Helpers for the system prompt ──────────────────────────────────────────

/**
 * Human-readable list of every trusted work, grouped by scope — used to
 * embed into the truth-rules system prompt so the model sees the
 * authoritative inventory it's allowed to draw from.
 */
export function formatTrustedWorksForPrompt(): string {
  const groups: Array<{ title: string; scope: Scope | Scope[] }> = [
    { title: "Greek NT lexica", scope: "greek-nt" },
    { title: "Greek (general & Classical) lexica", scope: "greek-general" },
    { title: "Septuagint lexica", scope: "lxx" },
    { title: "Hebrew / Old Testament lexica", scope: "hebrew-ot" },
    { title: "Aramaic lexica", scope: "aramaic" },
    {
      title: "Critical editions (primary texts)",
      scope: "primary-text",
    },
  ];

  const lines: string[] = [];
  for (const g of groups) {
    const want = Array.isArray(g.scope) ? g.scope : [g.scope];
    const works = TRUSTED_WORKS.filter(
      (w) => want.includes(w.scope) && w.type !== "grammar",
    );
    if (!works.length) continue;
    lines.push(`• ${g.title}:`);
    for (const w of works) {
      const yr = w.year ? ` (${w.year})` : "";
      lines.push(`    – ${w.abbrev} — ${w.editors}${yr}`);
    }
  }
  const grammars = TRUSTED_WORKS.filter((w) => w.type === "grammar");
  if (grammars.length) {
    lines.push(`• Greek & Hebrew grammars:`);
    for (const w of grammars) {
      const yr = w.year ? ` (${w.year})` : "";
      lines.push(`    – ${w.abbrev} — ${w.editors}${yr}`);
    }
  }
  return lines.join("\n");
}

export function formatProhibitedForPrompt(): string {
  return PROHIBITED_SOURCES.map(
    (p) => `    – ${p.name} — ${p.reason}`,
  ).join("\n");
}
