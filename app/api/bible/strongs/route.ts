import { NextResponse, type NextRequest } from "next/server";
import { formatRef } from "@/lib/bible/parseRef";
import { lookupStrongsOccurrences } from "@/lib/bible/strongsConcordance";

export const runtime = "nodejs";

const STRONG_RE = /^[GH]\d+$/;

/**
 * GET /api/bible/strongs?strong=G2316
 *
 * Returns how many KJV verses contain the Strong's number and the full list
 * of verse references (canon order).
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

  try {
    const hit = await lookupStrongsOccurrences(strong);
    if (!hit) {
      return NextResponse.json(
        { error: "invalid strong's number" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        strong: hit.strong,
        count: hit.count,
        verses: hit.verses.map((v) => ({
          book: v.book,
          chapter: v.chapter,
          verse: v.verse,
          label: formatRef({
            book: v.book,
            chapter: v.chapter,
            verseStart: v.verse,
          }),
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
