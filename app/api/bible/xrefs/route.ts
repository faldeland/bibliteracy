import { NextResponse, type NextRequest } from "next/server";
import { parseSingleRef, formatRef } from "@/lib/bible/parseRef";
import { lookupXRefs } from "@/lib/bible/xrefs";

export const runtime = "nodejs";

/**
 * GET /api/bible/xrefs?ref=John+3:16
 * GET /api/bible/xrefs?book=Jhn&chapter=3&verse=16
 *
 * Returns curated cross-references for the given passage. The dataset is
 * static and shipped with the app, so this endpoint is purely a parser +
 * formatter convenience for the client.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const refParam = searchParams.get("ref");
  const bookParam = searchParams.get("book");
  const chapterParam = searchParams.get("chapter");
  const verseParam = searchParams.get("verse");

  let parsed = null as ReturnType<typeof parseSingleRef>;

  if (refParam) {
    parsed = parseSingleRef(refParam);
  } else if (bookParam && chapterParam) {
    const composed = verseParam
      ? `${bookParam} ${chapterParam}:${verseParam}`
      : `${bookParam} ${chapterParam}`;
    parsed = parseSingleRef(composed);
  }

  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Provide either ?ref=<reference> (e.g. 'John 3:16') or ?book=<id>&chapter=<n>[&verse=<n>].",
      },
      { status: 400 },
    );
  }

  const hits = lookupXRefs(parsed);
  return NextResponse.json(
    {
      query: parsed,
      label: formatRef(parsed),
      count: hits.length,
      results: hits.map((h) => ({
        to: h.to,
        toLabel: formatRef(h.to),
        category: h.category,
        note: h.note,
        from: h.from,
        fromLabel: formatRef(h.from),
      })),
    },
    {
      headers: {
        // Static dataset — cache aggressively at the edge.
        "cache-control": "public, max-age=86400, s-maxage=86400",
      },
    },
  );
}
