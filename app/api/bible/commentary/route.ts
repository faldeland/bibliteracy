import { NextResponse, type NextRequest } from "next/server";
import { bookById } from "@/lib/bible/books";
import { fetchBollsCommentaryChapter } from "@/lib/bible/bollsCommentary";
import {
  DEFAULT_COMMENTARY_SOURCE_ID,
  getCommentarySource,
} from "@/lib/bible/commentarySources";
import { fetchHelloaoCommentaryChapter } from "@/lib/bible/helloaoCommentary";
import { helloaoChapterToView } from "@/lib/bible/helloaoCommentaryView";

export const runtime = "nodejs";

/**
 * GET /api/bible/commentary?book=Jhn&chapter=3&source=jamieson-fausset-brown
 *
 * `source` is a commentary source id from `lib/bible/commentarySources.ts`
 * (helloao.org or bolls.life).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("book");
  const chapter = Number(searchParams.get("chapter"));
  const sourceId =
    searchParams.get("source") ??
    searchParams.get("commentary") ??
    DEFAULT_COMMENTARY_SOURCE_ID;

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

  const source = getCommentarySource(sourceId);
  if (!source) {
    return NextResponse.json(
      { error: `unknown commentary source: ${sourceId}` },
      { status: 400 },
    );
  }

  try {
    let view;
    if (source.provider === "bolls") {
      view = await fetchBollsCommentaryChapter(bookId, chapter, source);
    } else {
      const helloaoId = source.helloaoCommentaryId ?? source.id;
      const data = await fetchHelloaoCommentaryChapter(
        helloaoId,
        bookId,
        chapter,
      );
      view = helloaoChapterToView(source, data);
    }
    return NextResponse.json({
      book: bookId,
      chapter,
      sourceId: source.id,
      view,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Commentary fetch failed";
    return NextResponse.json(
      { book: bookId, chapter, sourceId: source.id, error: message },
      { status: 502 },
    );
  }
}
