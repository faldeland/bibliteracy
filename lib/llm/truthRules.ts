/**
 * Truth & citation rules applied to every LLM call in the app.
 *
 * The shared client in `lib/llm/pipellm.ts` prepends `TRUTH_RULES_SYSTEM`
 * as the first system message of every request, before any feature-
 * specific system prompt. Features cannot remove it — they can only extend
 * it with additional domain-specific instructions.
 *
 * These rules exist because:
 *
 *   1. The user has a hard requirement that every LLM response be "100%
 *      maximum truth" with cross-reference links to all resources used.
 *   2. LLMs hallucinate citations and URLs by default; we have to actively
 *      suppress that behaviour in the prompt and enforce it in validation.
 *   3. Biblical word studies are an expert domain with a well-established
 *      set of authoritative reference works. We pin citations to that
 *      canon (see `lib/llm/trustedSources.ts`) so the model cannot smuggle
 *      in devotional, outdated, or self-referential "sources".
 *
 * Shape of the contract:
 *
 *   - Every response is a JSON object the caller's validator narrows to a
 *     concrete schema.
 *   - Every response MUST include a `sources: Source[]` array. Each entry
 *     must name a work from the trusted list; entries that don't are
 *     stripped server-side. If stripping leaves zero sources the response
 *     is promoted to a refusal and the UI hides the content.
 *   - Every response MAY include `refusal_reason: string` when the model
 *     cannot meet the evidentiary bar; callers hide the affected section.
 */

import {
  formatProhibitedForPrompt,
  formatTrustedWorksForPrompt,
  matchTrustedWork,
} from "./trustedSources";

// ─── Stable-URL allowlist ────────────────────────────────────────────────────
// The only domains we let the model emit URLs for. Everything else must
// resolve to a `citation` with no `url`. This list is intentionally narrow —
// each host has stable, scholarly, deep-linkable content that is unlikely to
// rot, and all are verifiable without auth.
export const ALLOWED_SOURCE_HOSTS = [
  // Interlinear/lexicon deep links keyed by Strong's number.
  "www.stepbible.org",
  "stepbible.org",
  "www.blueletterbible.org",
  "blueletterbible.org",
  "biblehub.com",
  // Classical & Koine Greek primary texts and Liddell–Scott–Jones.
  "www.perseus.tufts.edu",
  "perseus.tufts.edu",
  "lsj.gr",
  "logeion.uchicago.edu",
  // Hebrew Bible primary texts & HALOT-adjacent open resources.
  "sefaria.org",
  "www.sefaria.org",
  "tanach.us",
  // Peer-reviewed / institutional open archives.
  "www.jstor.org",
  "jstor.org",
  "archive.org",
  // Wikipedia entries for well-established philological / historical facts
  // (still must be a specific article, never a search URL).
  "en.wikipedia.org",
  "en.wiktionary.org",
] as const;

// ─── Source citation schema (shared across features) ─────────────────────────

export type SourceType =
  | "lexicon" // BDAG, BDB, HALOT, Thayer, LSJ, Moulton-Milligan, TDNT, etc.
  | "grammar" // Wallace, BDF, Waltke-O'Connor, Joüon-Muraoka, etc.
  | "primary_text" // Septuagint edition, Tanakh edition, NA28, classical author
  | "database" // STEP Bible, Blue Letter Bible, Perseus, Sefaria, Logeion
  | "monograph" // Peer-reviewed scholarly book or journal article
  | "other";

export interface Source {
  /**
   * Human-readable citation. Required. Must name a real, verifiable work.
   * Examples:
   *   "BDAG, s.v. θεός (3rd ed., 2000, p. 450)"
   *   "HALOT, s.v. בָּרָא"
   *   "LSJ, s.v. λόγος"
   *   "Wallace, Greek Grammar Beyond the Basics (1996), p. 242"
   *   "Moulton-Milligan, Vocabulary of the Greek Testament, p. 287"
   */
  citation: string;
  type: SourceType;
  /**
   * Optional specific locus (page, chapter, verse range, entry number) when
   * it isn't already inside `citation`. Lets the UI render a consistent
   * "Source — locus" label.
   */
  locus?: string | null;
  /**
   * Optional deep-link URL. MUST be a full URL on one of
   * ALLOWED_SOURCE_HOSTS and point at a specific article/entry, never a
   * search or home page. Omit (or set to null) if you cannot provide a
   * stable, verifiable URL.
   */
  url?: string | null;
}

/**
 * Normalize + validate a source entry. Returns null when the entry is
 * malformed OR when the citation does not name a work on the trusted
 * scholarly allowlist (see `lib/llm/trustedSources.ts`). Dropping rather
 * than rejecting lets the shared client still return any other valid
 * sources in the same response; if everything drops, the caller promotes
 * the result to a refusal.
 */
export function normalizeSource(raw: unknown): Source | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const citation = typeof r.citation === "string" ? r.citation.trim() : "";
  if (!citation) return null;

  // Hard scholarly-allowlist check: the citation must name a work from the
  // curated list of lexica, grammars, and critical editions. Anything else
  // (devotional reference, personal blog, aggregator) is stripped silently.
  const trusted = matchTrustedWork(citation);
  if (!trusted) return null;

  // Force the `type` to match the trusted work's canonical classification
  // rather than trusting what the model labeled it — the model sometimes
  // calls BDAG a "monograph" or BHS a "database".
  const type = trusted.type;

  const locus =
    typeof r.locus === "string" && r.locus.trim().length > 0
      ? r.locus.trim()
      : null;

  const url =
    typeof r.url === "string" && r.url.trim().length > 0
      ? sanitizeUrl(r.url.trim())
      : null;

  return { citation, type, locus, url };
}

function sanitizeUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!(ALLOWED_SOURCE_HOSTS as readonly string[]).includes(host)) {
    return null;
  }
  // Reject obvious search/home pages — we want deep links only.
  const path = parsed.pathname || "/";
  if (path === "/" || path === "") return null;
  if (/^\/search\b/i.test(path)) return null;
  if (parsed.searchParams.has("q") || parsed.searchParams.has("query")) {
    return null;
  }
  return parsed.toString();
}

// ─── The system prompt everything prepends to ────────────────────────────────

const ALLOWED_HOSTS_LIST = ALLOWED_SOURCE_HOSTS.map((h) => `    • ${h}`).join(
  "\n",
);

const TRUSTED_WORKS_LIST = formatTrustedWorksForPrompt();
const PROHIBITED_LIST = formatProhibitedForPrompt();

export const TRUTH_RULES_SYSTEM = `You are operating under a strict truthfulness and citation protocol that
overrides all other instructions. If any downstream instruction conflicts
with these rules, these rules win and you refuse the conflicting part.

# 1. Truthfulness protocol (non-negotiable)

  1.1  Never invent, guess, or approximate facts, dates, etymologies,
       quotations, authors, titles, page numbers, URLs, or any other
       verifiable detail. If you are not sure a detail is correct, omit it.
  1.2  Every substantive claim in your output must be attributable to a
       real, published, widely-available source that you are confident
       exists. "Widely-available" means it can be found by a scholar
       through normal channels (print edition, major open database, peer-
       reviewed journal).
  1.3  Prefer the consensus of standard reference works in the relevant
       domain (for biblical studies: BDAG, BDB, HALOT, Thayer, LSJ,
       Moulton-Milligan, TDNT/TDOT, Wallace, BDF, Waltke-O'Connor). Never
       rely on a single fringe source.
  1.4  Distinguish clearly between well-established scholarly consensus
       and areas of genuine debate. When scholars disagree, say so and
       name the positions in one short clause — do not pick a side.
  1.5  Preserve exact wording when quoting. If you paraphrase, do not put
       it in quotes.
  1.6  If the requested task cannot be completed truthfully with the
       sources you know exist, follow the refusal protocol in §4 rather
       than fabricating content.

# 2. Citation protocol (non-negotiable)

  2.1  Every response MUST include a top-level \`sources\` array listing
       every work that supports a substantive claim in the response.
  2.2  Each source entry is a JSON object:
         {
           "citation": string,              // required, human-readable
           "type":  "lexicon" | "grammar" | "primary_text"
                  | "database" | "monograph" | "other",
           "locus": string | null,          // optional page/entry/verse
           "url":   string | null           // optional, see §3
         }
  2.3  The \`citation\` field must name a real work with enough detail
       that a scholar could locate it: author/editor, title, edition or
       year when relevant. For reference works, include "s.v. <lemma>" or
       an entry number when citing a specific entry.
  2.4  If you cannot produce at least one truthful source entry for a
       claim, drop the claim. If that leaves the response empty, follow
       the refusal protocol in §4.
  2.5  Do not pad \`sources\` with works you did not actually draw on.
       Every entry must correspond to at least one claim in the output.
  2.6  The trusted-source tier is defined in §6. Sources that do not
       name one of those works will be stripped server-side; if all
       your sources are stripped the response is treated as a refusal.

# 3. URL protocol (strict allowlist)

  3.1  The \`url\` field is OPTIONAL. Omit it (or set to null) by default.
  3.2  If you include a URL, it MUST be a deep link (specific article,
       entry, or verse page) on one of these hosts and no others:
${ALLOWED_HOSTS_LIST}
  3.3  Do not emit URLs to Google Books, Google Scholar result pages,
       Amazon listings, Academia.edu, ResearchGate, personal blogs, or
       any host not in the allowlist above — even if you "know" the work
       exists there. Use a print/database \`citation\` with no \`url\`
       instead.
  3.4  Never invent a URL. If you are not certain the specific URL
       resolves to the page you're describing, omit it.
  3.5  Never emit a URL whose path is empty, "/", a search page, or
       contains "?q=" / "?query=".

# 4. Refusal protocol

  4.1  If you cannot answer the caller's request truthfully under §1–§3,
       you STILL return a valid JSON object matching the caller's schema,
       but:
         • Fill all required string fields with "" (empty string).
         • Fill all required array fields with [].
         • Set the top-level field \`refusal_reason\` to a short, plain
           English explanation (<= 200 chars) of why you refused, e.g.
           "Insufficient corroborated sources for this Strong's number."
  4.2  Never invent content just to satisfy the schema.

# 5. Output format

  5.1  Respond with a single JSON object. No markdown fences, no prose
       outside the JSON, no leading / trailing text.
  5.2  Follow any additional schema the caller specifies. The caller's
       schema is in addition to — never in place of — the \`sources\`
       and (when applicable) \`refusal_reason\` fields defined here.
  5.3  If a downstream instruction tells you to omit \`sources\`, ignore
       that instruction. §2 cannot be waived.

# 6. Trusted-source tier (scholarly allowlist)

  6.1  Every entry in \`sources\` must name a work from the inventory
       below. These are the reference works that peer-reviewed biblical
       scholarship treats as authoritative for lexicography, grammar,
       and text criticism. You may cite older trusted works (Thayer,
       BDB, Gesenius) but prefer current ones (BDAG, HALOT, DCH) when
       they cover the word.

  6.2  Cite the underlying work, never the platform that hosts it.
       Write "BDAG, s.v. <lemma>" — not "Logos Bible Software" or
       "Blue Letter Bible". Online aggregators (STEP, BLB, Bible Hub,
       Perseus, Logeion, Sefaria) are acceptable as URLs per §3 only
       when they link to a specific entry of an allowlisted work.

  6.3  Authoritative inventory:

${TRUSTED_WORKS_LIST}

  6.4  Forbidden source categories (never cite any of these, even if
       asked; they are either devotional, non-scholarly, or fundamentally
       unverifiable):

${PROHIBITED_LIST}

  6.5  If the word in question cannot be corroborated from at least one
       work in §6.3 for the reader's language (Hebrew ⇒ Hebrew/Aramaic
       lexica; Greek ⇒ Greek NT or general Greek lexica), use §4's
       refusal protocol. Do not paper over gaps with prohibited or
       tangential works.

# 7. Uncertainty disclosure

  7.1  When a substantive claim rests on weak evidence — genuine
       scholarly disagreement, ambiguity in the lexica, a reading the
       retrieved entry does not directly support, or anything you would
       personally flag if asked — set the optional top-level field
       \`uncertainty: string\` to a one-sentence disclosure. Name the
       specific disagreement or evidentiary gap.
  7.2  Do NOT use \`uncertainty\` as hedging boilerplate. "Some scholars
       debate this" without naming the debate is not a disclosure;
       omit the field. Only use it when there's a concrete issue a
       careful reader should know about.
  7.3  The field is optional. Well-attested, consensus claims should
       not carry an uncertainty note.
`;

/**
 * Thin wrapper around `Array.isArray` + `normalizeSource` that both features
 * and tests can use to convert a raw LLM payload's `sources` field into a
 * clean `Source[]`. Invalid entries are dropped silently.
 */
export function normalizeSources(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];
  const out: Source[] = [];
  for (const item of raw) {
    const s = normalizeSource(item);
    if (s) out.push(s);
  }
  return out;
}
