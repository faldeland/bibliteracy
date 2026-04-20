import { NextResponse } from "next/server";
import { translationIsConfigured } from "@/lib/bible/providers";
import { TRANSLATIONS } from "@/lib/bible/translations";

export const runtime = "nodejs";

/**
 * GET /api/bible/providers
 *
 * Returns a small map of translation-id → { configured, requiresEnvKey } so
 * the client picker can disable entries that won't fetch in this
 * deployment (e.g. ESV when ESV_API_KEY is unset). Only translations whose
 * provider needs an env key are included; the rest are always configured.
 *
 * No secret values are returned — only booleans and the env var NAMES.
 */
export async function GET() {
  const out: Record<
    string,
    { configured: boolean; requiresEnvKey: string }
  > = {};
  for (const t of TRANSLATIONS) {
    if (!t.requiresEnvKey) continue;
    out[t.id] = {
      configured: translationIsConfigured(t),
      requiresEnvKey: t.requiresEnvKey,
    };
  }
  return NextResponse.json(
    { providers: out },
    {
      headers: {
        // Tiny payload, but it can change when the operator rotates a key
        // and redeploys. Keep the cache short.
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
