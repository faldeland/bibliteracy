import { NextResponse, type NextRequest } from "next/server";
import { fetchWordStudies } from "@/lib/bible/bollsApi";

export const runtime = "nodejs";

const STRONG_RE = /^[GH]\d+$/;

/**
 * GET /api/bible/words?strongs=G2316,G3056,H7225
 *
 * Returns a map of Strong's-number → word study (lexeme, transliteration,
 * short gloss, full BDB/Thayer's HTML).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const param = searchParams.get("strongs") ?? "";
  const requested = param
    .split(",")
    .map((s) => s.trim())
    .filter((s) => STRONG_RE.test(s));

  if (requested.length === 0) {
    return NextResponse.json({ words: {} });
  }
  // Hard cap so a malicious caller can't fan us out across thousands of
  // upstream lookups in a single request.
  const limited = requested.slice(0, 200);

  try {
    const words = await fetchWordStudies(limited);
    return NextResponse.json(
      { words },
      {
        headers: {
          "cache-control": "public, max-age=86400, s-maxage=86400",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
