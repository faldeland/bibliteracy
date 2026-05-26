import { NextResponse, type NextRequest } from "next/server";
import { searchDictionaryMatches } from "@/lib/bible/bollsApi";

export const runtime = "nodejs";

/**
 * GET /api/bible/strongs/words?q=god
 *
 * Reverse BDB/Thayer lookup: English (or lemma) → matching Strong's numbers.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  try {
    const matches = await searchDictionaryMatches(q);
    return NextResponse.json(
      {
        query: q,
        matches: matches.map((m) => ({
          strong: m.strong,
          lexeme: m.lexeme,
          transliteration: m.transliteration,
          shortGloss: m.shortGloss,
        })),
      },
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
