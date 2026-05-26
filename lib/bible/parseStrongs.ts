const STRONG_RE = /^[GH]\d+$/;

/** Letters in Latin, Hebrew, or Greek — enough for an English or lemma word query. */
const WORD_LETTER_RE = /[a-zA-Z\u0370-\u03FF\u0590-\u05FF]/;

export type StrongsSearchQuery =
  | { kind: "strong"; strong: string }
  | { kind: "word"; word: string };

/**
 * Normalize free-form Strong's input (e.g. `g 2316`, `G2316`) to `G2316` / `H7225`,
 * or return null when the value cannot be a Strong's number.
 */
export function parseStrongsQuery(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) return null;

  const letterDigit = compact.match(/^([gh])(\d+)$/i);
  if (letterDigit) {
    return `${letterDigit[1]!.toUpperCase()}${letterDigit[2]}`;
  }

  return STRONG_RE.test(compact) ? compact : null;
}

export function isValidStrongsNumber(strong: string): boolean {
  return STRONG_RE.test(strong);
}

/**
 * Classify concordance search input as a Strong's number or a dictionary word
 * (English gloss, transliteration, or Hebrew/Greek lemma).
 */
export function classifyStrongsSearchQuery(
  raw: string,
): StrongsSearchQuery | null {
  const strong = parseStrongsQuery(raw);
  if (strong) return { kind: "strong", strong };

  const word = raw.trim();
  if (!word || !WORD_LETTER_RE.test(word)) return null;
  return { kind: "word", word };
}
