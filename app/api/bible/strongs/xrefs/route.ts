import { NextResponse, type NextRequest } from "next/server";
import { lookupStrongsXRefs } from "@/lib/bible/strongsXrefs";

export const runtime = "nodejs";

const STRONG_RE = /^[GH]\d+$/;

/**
 * GET /api/bible/strongs/xrefs?strong=G2316
 *
 * Curated cross-references from every KJV verse containing the Strong's
 * number, de-duplicated by destination.
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
    const hit = await lookupStrongsXRefs(strong);
    if (!hit) {
      return NextResponse.json(
        { error: "invalid strong's number" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { strong, count: hit.count, xrefs: hit.xrefs },
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
