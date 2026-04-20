import { NextResponse, type NextRequest } from "next/server";
import { fetchWordStudies } from "@/lib/bible/bollsApi";
import { fetchWordUsage, wordUsageConfigured } from "@/lib/bible/wordUsage";

export const runtime = "nodejs";

const STRONG_RE = /^[GH]\d+$/;

/**
 * GET /api/bible/usage?strong=G2316
 *
 * Returns `{ usage: WordUsage | null, configured: boolean }`. The caller
 * first loads the full word study from /api/bible/words; this endpoint then
 * augments it with an LLM-generated note on how the word was commonly used
 * in its own time period. On-demand and memoized per Strong's.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const strong = (searchParams.get("strong") ?? "").trim();
  if (!STRONG_RE.test(strong)) {
    return NextResponse.json(
      { error: "strong must match /^[GH]\\d+$/" },
      { status: 400 },
    );
  }

  const configured = wordUsageConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, usage: null });
  }

  // We need the lexeme / gloss to ground the LLM. Re-use the same fetcher
  // used for the inline interlinear; it's aggressively cached upstream.
  const studies = await fetchWordStudies([strong]);
  const study = studies[strong];
  if (!study) {
    return NextResponse.json(
      { error: "unknown strong's number" },
      { status: 404 },
    );
  }

  const usage = await fetchWordUsage(study);
  return NextResponse.json(
    { configured: true, usage },
    {
      headers: {
        // Usage notes don't change for a given Strong's. Safe to cache hard.
        "cache-control": "public, max-age=31536000, s-maxage=31536000",
      },
    },
  );
}
