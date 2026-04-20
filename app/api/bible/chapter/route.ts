import { NextResponse, type NextRequest } from "next/server";
import { bookById } from "@/lib/bible/books";
import {
  fetchChapter,
  ProviderConfigError,
  translationIsConfigured,
} from "@/lib/bible/providers";
import {
  DEFAULT_TRANSLATION_ID,
  getTranslation,
  translationCovers,
} from "@/lib/bible/translations";

export const runtime = "nodejs";

/**
 * GET /api/bible/chapter?book=Jhn&chapter=3&translation=ESV
 *
 * Returns the requested chapter as an array of verses, each verse already
 * tokenized for the interlinear view (Strong's-tagged translations) or
 * collapsed to a single plain-text token (every other translation).
 *
 * `translation` is optional and defaults to KJV. Any registry slug works;
 * an unknown slug or a translation that doesn't cover the requested book's
 * testament transparently falls back to the default. If the chosen
 * translation needs a server-side API key (ESV, NLT) and the env var isn't
 * set, the route returns a 501 with a helpful message instead of fetching.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("book");
  const chapter = Number(searchParams.get("chapter"));
  const requestedTranslation =
    searchParams.get("translation") ?? DEFAULT_TRANSLATION_ID;

  if (!bookId) {
    return NextResponse.json({ error: "book required" }, { status: 400 });
  }
  const book = bookById(bookId);
  if (!book) {
    return NextResponse.json({ error: "unknown book" }, { status: 404 });
  }
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) {
    return NextResponse.json({ error: "chapter out of range" }, { status: 400 });
  }

  const wanted = getTranslation(requestedTranslation);
  const translation = translationCovers(wanted, book.testament)
    ? wanted
    : getTranslation(DEFAULT_TRANSLATION_ID);

  // Refuse early when a publisher-API translation is missing its env key,
  // so we don't waste an upstream call and the client gets a clear error
  // it can render in the picker / verse area.
  if (!translationIsConfigured(translation)) {
    return NextResponse.json(
      {
        book: bookId,
        chapter,
        translation: translation.id,
        error: `${translation.label} requires the ${translation.requiresEnvKey} environment variable. See .env.example.`,
        configMissing: translation.requiresEnvKey,
      },
      { status: 501 },
    );
  }

  try {
    const verses = await fetchChapter(bookId, chapter, translation);
    return NextResponse.json(
      {
        book: bookId,
        chapter,
        translation: translation.id,
        attribution: translation.attribution ?? null,
        verses,
      },
      {
        headers: {
          "cache-control": "public, max-age=3600, s-maxage=3600",
        },
      },
    );
  } catch (e) {
    if (e instanceof ProviderConfigError) {
      return NextResponse.json(
        { error: e.message, configMissing: translation.requiresEnvKey },
        { status: 501 },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
