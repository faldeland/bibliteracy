// Server-side dispatcher for chapter fetches. The /api/bible/chapter route
// resolves a Translation from the registry and calls fetchChapter() here;
// this module routes to the right provider adapter based on the
// translation's `provider` field.

import type { Translation } from "../translations";
import * as bolls from "./bolls";
import * as esv from "./esv";
import * as net from "./net";
import * as nlt from "./nlt";
import {
  ProviderConfigError,
  type ParsedVerse,
} from "./types";

export type { ParsedVerse } from "./types";
export { ProviderConfigError, ProviderUpstreamError } from "./types";

export async function fetchChapter(
  bookId: string,
  chapter: number,
  translation: Translation,
): Promise<ParsedVerse[]> {
  switch (translation.provider) {
    case "bolls":
      return bolls.fetchChapter(bookId, chapter, translation.id);
    case "esv":
      return esv.fetchChapter(bookId, chapter);
    case "nlt":
      return nlt.fetchChapter(bookId, chapter);
    case "net":
      return net.fetchChapter(bookId, chapter);
    default: {
      // Exhaustiveness check — TS will flag a missing case here.
      const _exhaustive: never = translation.provider;
      throw new ProviderConfigError(
        `Unknown translation provider: ${String(_exhaustive)}`,
      );
    }
  }
}

/**
 * Returns true when the given translation can actually fetch right now —
 * i.e. its required env key (if any) is present in the server env.
 *
 * The /api/bible/providers endpoint exposes a derived map of these so the
 * client picker can disable entries that won't work without configuration.
 */
export function translationIsConfigured(t: Translation): boolean {
  if (!t.requiresEnvKey) return true;
  const v = process.env[t.requiresEnvKey];
  return typeof v === "string" && v.length > 0;
}
