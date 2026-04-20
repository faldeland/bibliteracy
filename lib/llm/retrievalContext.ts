/**
 * Retrieval-context helpers for RAG grounding of word-study LLM calls.
 *
 * We already fetch the full BDB / Thayer's HTML entry from bolls.life when
 * resolving a Strong's number (see `lib/bible/bollsApi.ts`). Without
 * grounding, the model generates its reply purely from parametric recall;
 * with grounding, we inject the entry as part of the prompt so the draft
 * is steered toward the authoritative text and we have a concrete
 * ground-truth document to audit the draft against.
 *
 * We strip HTML rather than keep it — BDB/Thayer markup is noisy
 * (cross-reference `<a href=S:G####>` links, small-caps, etc.) and the
 * token budget is better spent on the semantic content.
 */

export interface RetrievedEntry {
  /** Short label used in prompts: "BDB" for Hebrew, "Thayer" for Greek. */
  source: string;
  /** Cleaned, length-capped plain-text lexicon entry. */
  text: string;
  /** True when the retrieved entry is long enough to constitute real grounding. */
  hasContent: boolean;
}

const MAX_LEN = 4500;

/**
 * Label the retrieved entry by the Strong's prefix. bolls.life's BDBT
 * concordance gives us BDB for H#### and Thayer for G####, so we can
 * hard-code the label without extra lookup.
 */
function sourceFor(strong: string): string {
  return strong.startsWith("H") ? "BDB" : "Thayer";
}

export function buildRetrievedEntry(
  strong: string,
  detailHtml: string,
): RetrievedEntry {
  const text = htmlToText(detailHtml);
  const capped =
    text.length > MAX_LEN ? `${text.slice(0, MAX_LEN)}\n…(truncated)` : text;
  return {
    source: sourceFor(strong),
    text: capped,
    // A useful BDB/Thayer entry is usually >= ~120 chars. Below that
    // we're looking at stub entries for rare proper nouns where
    // grounding won't help; flag it so the prompt can skip the context
    // block entirely rather than lying about having a source.
    hasContent: capped.trim().length >= 120,
  };
}

/**
 * Minimal HTML → text pass. We're not trying to faithfully preserve
 * structure — just get the lexicographical prose out where the model
 * can read it. Keeps line breaks around block elements so definitions
 * and sense numbers don't smash together.
 */
function htmlToText(html: string): string {
  if (!html) return "";
  const withBreaks = html
    // Drop script/style just in case.
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Preserve some structure by turning block boundaries into newlines.
    .replace(/<\s*(br|p|div|li|tr|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    // Collapse bolls.life's cross-ref anchors to their visible text.
    .replace(/<a\s+href=S:[^>]*>([^<]*)<\/a>/gi, "$1")
    // Drop everything else.
    .replace(/<[^>]+>/g, "");

  return decodeEntities(withBreaks)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Covers the entities bolls.life actually emits. A full HTML-entity
 * decoder would be overkill and pulls a dependency we don't need.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Format a retrieved entry as a fenced block the model can consume. We
 * label the source so the audit step has a consistent anchor to cite
 * back to when flagging contradictions.
 */
export function formatRetrievedBlock(entry: RetrievedEntry): string {
  if (!entry.hasContent) return "";
  return [
    "",
    `[RETRIEVED LEXICON ENTRY — ${entry.source}]`,
    entry.text,
    `[END RETRIEVED ENTRY]`,
    "",
    `Treat the retrieved ${entry.source} entry above as ground truth.`,
    "Every factual claim in your reply must be consistent with it. You",
    "may still draw on other trusted works from §6 for sense coverage",
    `the retrieved entry does not address, but you may not contradict`,
    `the ${entry.source} entry. When the retrieved entry is silent on a`,
    "point, say so or cite a different trusted work that covers it.",
  ].join("\n");
}
