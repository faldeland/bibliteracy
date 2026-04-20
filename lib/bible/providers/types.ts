// Shared types for chapter-fetch providers. Each provider lives in its own
// file (bolls.ts, esv.ts, nlt.ts, net.ts) and exports a `fetchChapter`
// function that conforms to the signature below.
//
// All providers normalize their upstream response into the same
// `ParsedVerse[]` shape so the BibleReader can render them uniformly. Only
// `provider: "bolls"` entries with a Strong's-tagged translation actually
// populate `tokens[].strong`; all others produce a single token whose `text`
// is the verse and `strong` is null, with the canonical text in `plain`.

export interface VerseToken {
  text: string;
  strong: string | null;
}

export interface ParsedVerse {
  verse: number;
  tokens: VerseToken[];
  plain: string;
}

export class ProviderConfigError extends Error {
  readonly code = "PROVIDER_CONFIG";
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

export class ProviderUpstreamError extends Error {
  readonly code = "PROVIDER_UPSTREAM";
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderUpstreamError";
    this.status = status;
  }
}
