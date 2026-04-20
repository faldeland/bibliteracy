import { NextResponse, type NextRequest } from "next/server";
import { fetchWordStudies } from "@/lib/bible/bollsApi";
import {
  fetchWordDeepDive,
  wordDeepDiveConfigured,
} from "@/lib/bible/wordDeepDive";

export const runtime = "nodejs";

const STRONG_RE = /^[GH]\d+$/;

/**
 * GET /api/bible/deep-dive?strong=G2316
 *
 * Returns `{ configured: boolean, deepDive: WordDeepDive | null }`. The
 * response is aggressively cached — a Strong's study is timeless for a
 * given prompt, so once a model has produced one we serve it forever.
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

  const configured = wordDeepDiveConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, deepDive: null });
  }

  // Ground the LLM in the same lexeme/gloss used by the inline popover so
  // it can't wander into the wrong entry.
  const studies = await fetchWordStudies([strong]);
  const study = studies[strong];
  if (!study) {
    return NextResponse.json(
      { error: "unknown strong's number" },
      { status: 404 },
    );
  }

  const deepDive = await fetchWordDeepDive(study);
  return NextResponse.json(
    { configured: true, deepDive },
    {
      headers: {
        "cache-control": "public, max-age=31536000, s-maxage=31536000",
      },
    },
  );
}
