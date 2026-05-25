// Bible translations available through the keyless bolls.life API.
//
// Most English translations render as a normal verse paragraph in the reader;
// the per-word interlinear lemma row is used for original-language Hebrew /
// Greek texts (Tanakh / Septuagint / Greek NT) and for KJV when it is the
// selected translation. The `hasStrongs` flag still matters because:
//
//   1. Entries whose `text` field embeds inline `<S>####</S>` tags power the
//      BDB / Thayer's word-study popover and the cross-reference links.
//   2. When the user reads any other English translation, the reader always
//      shows a KJV Strong's row underneath. KJV must stay `hasStrongs: true`
//      for that parallel strip (and for its own interlinear when selected).
//
// ─── Licensing notice (please read) ──────────────────────────────────────────
//
// bolls.life will return text for many copyrighted translations (NIV, NLT,
// CSB, ESV, NASB, NKJV, MSG, AMP, etc.). Receiving the bytes is NOT the same
// as having the right to redistribute them. For a public, multi-user app,
// only the entries marked `license: "public-domain" | "open"` are safe to
// ship without an explicit publisher license. The copyrighted entries are
// included for personal / private / development use; if you intend to deploy
// publicly with them, secure the appropriate license first (Crossway for ESV,
// Tyndale for NLT, Biblica for NIV, Lifeway for CSB, etc.).
//
// Source for slugs and metadata:
//   https://bolls.life/static/bolls/app/views/languages.json

export type TranslationCoverage = "OT" | "NT" | "ALL";
export type TranslationLicense =
  | "public-domain"
  | "open"
  | "copyrighted"
  | "licensed-via-publisher-api"
  | "unknown";
export type TranslationGroup =
  | "English (Modern)"
  | "English (Classic)"
  | "English (Catholic)"
  | "Hebrew"
  | "Greek"
  | "Other";

/**
 * Where a translation is fetched from. Each provider has its own server-side
 * adapter under `lib/bible/providers/`.
 *
 *   bolls — keyless public bolls.life API. Default for everything PD/open.
 *   esv   — Crossway's official api.esv.org. Requires ESV_API_KEY env var.
 *   nlt   — Tyndale's official api.nlt.to. Requires NLT_API_KEY env var.
 *   net   — Bible.org Labs API (https://labs.bible.org). Keyless, free with
 *           attribution per their TOS.
 */
export type TranslationProvider = "bolls" | "esv" | "nlt" | "net";

export interface Translation {
  /**
   * Stable id used inside the app and as the `?translation=` query param.
   * For provider="bolls" entries, this is the bolls.life short_name slug;
   * for other providers it's a sensible label-like id.
   */
  id: string;
  /** Short label for the dropdown (e.g. "KJV", "NIV"). */
  label: string;
  /** Full human-readable name for tooltips / detail rows. */
  fullName: string;
  /** Spoken language of the translation. */
  language: string;
  /** Reading direction of the translation's primary text. */
  dir: "ltr" | "rtl";
  /** Which testaments this translation actually covers. */
  coverage: TranslationCoverage;
  /** True when the upstream `text` embeds <S>####</S> Strong's tags. */
  hasStrongs: boolean;
  /**
   * True when the translation IS the original-language text (Hebrew Tanakh,
   * Greek NT, Septuagint). The interlinear UI uses this to set per-token
   * direction/typography.
   */
  original: boolean;
  /** Used to bucket entries into <optgroup>s in the picker. */
  group: TranslationGroup;
  /** Best-effort licensing classification — see the file header. */
  license: TranslationLicense;
  /** Where the bytes come from. */
  provider: TranslationProvider;
  /**
   * Name of the env var that must be set for this translation to fetch.
   * Undefined for keyless providers. The /api/bible/providers endpoint
   * exposes which env vars are present so the picker can disable entries
   * that won't work without configuration.
   */
  requiresEnvKey?: string;
  /**
   * Short attribution string to render in the verse footer. Required by
   * publisher APIs (Crossway, Tyndale, Bible.org).
   */
  attribution?: string;
}

// Bolls.life entries omit the `provider` field below for brevity — it's
// filled in to "bolls" by the `withDefaults()` pass at the bottom of the
// file. Entries using ESV / NLT / NET must set `provider` explicitly.
type RawTranslation = Omit<Translation, "provider"> & {
  provider?: TranslationProvider;
};

const RAW_TRANSLATIONS: readonly RawTranslation[] = [
  // ── English, modern (no Strong's) ────────────────────────────────────────
  {
    id: "BSB",
    label: "BSB",
    fullName: "Berean Standard Bible",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "public-domain",
  },
  {
    id: "WEB",
    label: "WEB",
    fullName: "World English Bible",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "public-domain",
  },
  {
    id: "LSV",
    label: "LSV",
    fullName: "Literal Standard Version",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "open",
  },
  {
    id: "NET",
    label: "NET",
    fullName:
      "New English Translation (Bible.org Labs) — keyless official API",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "licensed-via-publisher-api",
    provider: "net",
    attribution: "Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996, 2019 by Biblical Studies Press, L.L.C. http://netbible.com All rights reserved.",
  },
  {
    id: "ESV",
    label: "ESV",
    fullName:
      "English Standard Version (Crossway) — official api.esv.org, free tier",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "licensed-via-publisher-api",
    provider: "esv",
    requiresEnvKey: "ESV_API_KEY",
    attribution: "ESV® Bible (The Holy Bible, English Standard Version®), © 2001 Crossway. Used by permission. All rights reserved.",
  },
  {
    id: "NIV2011",
    label: "NIV (2011)",
    fullName: "New International Version, 2011",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "NIV",
    label: "NIV (1984)",
    fullName: "New International Version, 1984",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "NLT",
    label: "NLT",
    fullName:
      "New Living Translation (Tyndale) — official api.nlt.to, free tier",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "licensed-via-publisher-api",
    provider: "nlt",
    requiresEnvKey: "NLT_API_KEY",
    attribution: "Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
  },
  {
    id: "CSB17",
    label: "CSB",
    fullName: "Christian Standard Bible, 2017",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "NKJV",
    label: "NKJV",
    fullName: "New King James Version, 1982",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "NASB",
    label: "NASB",
    fullName: "New American Standard Bible (1995)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "LSB",
    label: "LSB",
    fullName: "The Legacy Standard Bible",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "AMP",
    label: "AMP",
    fullName: "Amplified Bible, 2015",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "MSG",
    label: "MSG",
    fullName: "The Message, 2002",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "MEV",
    label: "MEV",
    fullName: "Modern English Version",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "TLV",
    label: "TLV",
    fullName: "Tree of Life Version",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "CJB",
    label: "CJB",
    fullName: "The Complete Jewish Bible (1998)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "ISV",
    label: "ISV",
    fullName: "International Standard Version, 2011",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "CEB",
    label: "CEB",
    fullName: "Common English Bible, 2011",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "GNT",
    label: "GNT",
    fullName: "Good News Bible, 1976",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "GNTD",
    label: "GNT (Deutero)",
    fullName: "Good News Translation (US Version), 2001",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "ERV",
    label: "ERV",
    fullName: "Easy-to-Read Version, 2006",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "NLV",
    label: "NLV",
    fullName: "New Life Version, 1969",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "CEVD",
    label: "CEV",
    fullName: "Contemporary English Version, 2006 (with Apocrypha)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },
  {
    id: "AUV",
    label: "AUV",
    fullName: "An Understandable Version, 1995",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "open",
  },
  {
    id: "TS2009",
    label: "TS2009",
    fullName: "The Scriptures 2009",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Modern)",
    license: "copyrighted",
  },

  // ── English, classic ─────────────────────────────────────────────────────
  // KJV embeds Strong's tags and renders as an interlinear when selected.
  // ASV embeds Strong's tags but still uses the KJV parallel strip below.
  {
    id: "KJV",
    label: "KJV",
    fullName: "King James Version 1769 (with Apocrypha + Strong's Numbers)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: true,
    original: false,
    group: "English (Classic)",
    license: "public-domain",
  },
  {
    id: "ASV",
    label: "ASV",
    fullName: "American Standard Version 1901 (with Strong's Numbers)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: true,
    original: false,
    group: "English (Classic)",
    license: "public-domain",
  },
  {
    id: "YLT",
    label: "YLT",
    fullName: "Young's Literal Translation (1898)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Classic)",
    license: "public-domain",
  },
  {
    id: "GNV",
    label: "Geneva 1599",
    fullName: "Geneva Bible (1599)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Classic)",
    license: "public-domain",
  },
  {
    id: "RSV",
    label: "RSV",
    fullName: "Revised Standard Version (1952)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Classic)",
    license: "copyrighted",
  },
  {
    id: "LXXE",
    label: "LXX (Brenton)",
    fullName: "English Septuagint (Brenton, 1851)",
    language: "English",
    dir: "ltr",
    coverage: "OT",
    hasStrongs: false,
    original: false,
    group: "English (Classic)",
    license: "public-domain",
  },
  {
    id: "LBP",
    label: "Lamsa",
    fullName: "Aramaic Peshitta in English (Lamsa, 1933)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Classic)",
    license: "public-domain",
  },
  {
    id: "SPE",
    label: "Samaritan",
    fullName: "Samaritan Pentateuch in English, 2013",
    language: "English",
    dir: "ltr",
    coverage: "OT",
    hasStrongs: false,
    original: false,
    group: "English (Classic)",
    license: "open",
  },

  // ── English, Catholic editions (no Strong's) ─────────────────────────────
  {
    id: "DRB",
    label: "Douay-Rheims",
    fullName: "Douay Rheims Bible",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Catholic)",
    license: "public-domain",
  },
  {
    id: "RSV2CE",
    label: "RSV-2CE",
    fullName: "Revised Standard Version Catholic Edition, 2nd ed.",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Catholic)",
    license: "copyrighted",
  },
  {
    id: "NRSVCE",
    label: "NRSV-CE",
    fullName: "New Revised Standard Version Catholic Edition, 1993",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Catholic)",
    license: "copyrighted",
  },
  {
    id: "NABRE",
    label: "NABRE",
    fullName: "New American Bible (Revised Edition)",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Catholic)",
    license: "copyrighted",
  },
  {
    id: "NJB1985",
    label: "NJB",
    fullName: "New Jerusalem Bible, 1985",
    language: "English",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: false,
    original: false,
    group: "English (Catholic)",
    license: "copyrighted",
  },

  // ── Hebrew originals ─────────────────────────────────────────────────────
  {
    id: "WLCa",
    label: "WLC + Strong's",
    fullName:
      "Westminster Leningrad Codex (vowels, accents, Strong's numbers)",
    language: "Hebrew",
    dir: "rtl",
    coverage: "OT",
    hasStrongs: true,
    original: true,
    group: "Hebrew",
    license: "public-domain",
  },
  {
    id: "WLC",
    label: "WLC (vowels)",
    fullName: "Westminster Leningrad Codex (with vowels)",
    language: "Hebrew",
    dir: "rtl",
    coverage: "OT",
    hasStrongs: false,
    original: true,
    group: "Hebrew",
    license: "public-domain",
  },
  {
    id: "WLCC",
    label: "WLC (consonants)",
    fullName: "Westminster Leningrad Codex (consonants only)",
    language: "Hebrew",
    dir: "rtl",
    coverage: "OT",
    hasStrongs: false,
    original: true,
    group: "Hebrew",
    license: "public-domain",
  },
  {
    id: "HAC",
    label: "Aleppo",
    fullName: "Tanakh — Aleppo Codex",
    language: "Hebrew",
    dir: "rtl",
    coverage: "OT",
    hasStrongs: false,
    original: true,
    group: "Hebrew",
    license: "public-domain",
  },
  {
    id: "DHNT",
    label: "Delitzsch NT",
    fullName: "Delitzsch's Hebrew New Testament 1877 / 1998 (with vowels)",
    language: "Hebrew",
    dir: "rtl",
    coverage: "NT",
    hasStrongs: false,
    original: false,
    group: "Hebrew",
    license: "public-domain",
  },

  // ── Greek originals ──────────────────────────────────────────────────────
  {
    id: "TISCH",
    label: "Tischendorf",
    fullName: "Tischendorf's Greek NT, 8th ed. (with Strong's)",
    language: "Greek",
    dir: "ltr",
    coverage: "NT",
    hasStrongs: true,
    original: true,
    group: "Greek",
    license: "public-domain",
  },
  {
    id: "NTGT",
    label: "Tischendorf (plain)",
    fullName: "Greek NT: Tischendorf 8th ed.",
    language: "Greek",
    dir: "ltr",
    coverage: "NT",
    hasStrongs: false,
    original: true,
    group: "Greek",
    license: "public-domain",
  },
  {
    id: "TR",
    label: "Textus Receptus",
    fullName: "Elzevir Textus Receptus (1624)",
    language: "Greek",
    dir: "ltr",
    coverage: "NT",
    hasStrongs: false,
    original: true,
    group: "Greek",
    license: "public-domain",
  },
  {
    id: "LXX",
    label: "Septuagint",
    fullName: "Septuagint (Greek OT)",
    language: "Greek",
    dir: "ltr",
    coverage: "OT",
    hasStrongs: false,
    original: true,
    group: "Greek",
    license: "public-domain",
  },

  // ── Other (one well-known non-English with Strong's) ─────────────────────
  {
    id: "DSV",
    label: "DSV (Dutch)",
    fullName: "Statenvertaling met Strong's, 1619 (Dutch)",
    language: "Dutch",
    dir: "ltr",
    coverage: "ALL",
    hasStrongs: true,
    original: false,
    group: "Other",
    license: "public-domain",
  },
] as const;

export const TRANSLATIONS: readonly Translation[] = RAW_TRANSLATIONS.map(
  (t) => ({ ...t, provider: t.provider ?? "bolls" }),
);

export const DEFAULT_TRANSLATION_ID = "KJV";

const TRANSLATION_BY_ID = new Map<string, Translation>(
  TRANSLATIONS.map((t) => [t.id, t]),
);

export function getTranslation(id: string | null | undefined): Translation {
  if (!id) return TRANSLATION_BY_ID.get(DEFAULT_TRANSLATION_ID)!;
  return (
    TRANSLATION_BY_ID.get(id) ?? TRANSLATION_BY_ID.get(DEFAULT_TRANSLATION_ID)!
  );
}

/** Translations that include a given testament. */
export function translationsFor(
  testament: "OT" | "NT",
): readonly Translation[] {
  return TRANSLATIONS.filter(
    (t) => t.coverage === "ALL" || t.coverage === testament,
  );
}

/**
 * Returns true when the translation can render the given testament. Used to
 * decide whether to keep the user's preferred translation when they navigate
 * to a book in a different testament, or fall back to the default.
 */
export function translationCovers(
  t: Translation,
  testament: "OT" | "NT",
): boolean {
  return t.coverage === "ALL" || t.coverage === testament;
}

/**
 * Group translations by their `group` field, preserving the registry's
 * declaration order across groups and sorting items alphabetically (by
 * label, case-insensitive) within each group. Used to render both the
 * native <optgroup> dropdown and the searchable picker modal.
 */
export function groupTranslations(
  list: readonly Translation[],
): { group: TranslationGroup; items: Translation[] }[] {
  const out: { group: TranslationGroup; items: Translation[] }[] = [];
  const indexByGroup = new Map<TranslationGroup, number>();
  for (const t of list) {
    let idx = indexByGroup.get(t.group);
    if (idx === undefined) {
      idx = out.length;
      indexByGroup.set(t.group, idx);
      out.push({ group: t.group, items: [] });
    }
    out[idx].items.push(t);
  }
  const collator = new Intl.Collator("en", { sensitivity: "base" });
  for (const g of out) {
    g.items.sort((a, b) => collator.compare(a.label, b.label));
  }
  return out;
}
