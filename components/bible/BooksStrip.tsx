"use client";

import { useMemo } from "react";
import {
  BIBLE_BOOKS,
  TOTAL_BIBLE_WORDS,
  type BibleBook,
  type TanakhSection,
} from "@/lib/bible/books";
import { TOTAL_VERSES, bookRange } from "@/lib/bible/globalVerseIndex";
import { cn } from "@/lib/utils";

// Section tints: deliberately echo the BooksLane palette so the standalone
// /atlas view feels like the same instrument as the main grid. Slightly
// stronger than BooksLane's 70% mix because there's nothing else competing
// for attention down here.
const SECTION_TINT: Record<TanakhSection, string> = {
  Torah: "bg-amber-200",
  "Nevi'im": "bg-orange-200",
  Ketuvim: "bg-yellow-200",
  Gospels: "bg-emerald-200",
  Acts: "bg-teal-200",
  Pauline: "bg-sky-200",
  General: "bg-indigo-200",
  Revelation: "bg-rose-200",
};

export type BooksStripMode = "verse" | "word";

interface BooksStripProps {
  /** "verse": every verse takes equal width (matches Harrison's poster). */
  mode?: BooksStripMode;
  /** Pixel height of the colored bar; labels add ~14 px below. */
  height?: number;
  /** Hide the per-book labels (useful in cramped embedded mode). */
  hideLabels?: boolean;
  /** Highlight a single book id, e.g. on hover from a tooltip. */
  highlightBookId?: string | null;
  onHoverBook?: (bookId: string | null) => void;
  onSelectBook?: (bookId: string) => void;
}

interface Slice {
  book: BibleBook;
  /** Width as a fraction of the strip (0..1). */
  width: number;
}

function computeSlices(mode: BooksStripMode): Slice[] {
  if (mode === "word") {
    return BIBLE_BOOKS.map((b) => ({
      book: b,
      width: b.words / TOTAL_BIBLE_WORDS,
    }));
  }
  return BIBLE_BOOKS.map((b) => {
    const r = bookRange(b.id);
    const verses = r ? r.end - r.start : 0;
    return { book: b, width: verses / TOTAL_VERSES };
  });
}

export function BooksStrip({
  mode = "verse",
  height = 22,
  hideLabels = false,
  highlightBookId = null,
  onHoverBook,
  onSelectBook,
}: BooksStripProps) {
  const slices = useMemo(() => computeSlices(mode), [mode]);

  return (
    <div className="w-full select-none">
      <div
        className="relative flex w-full overflow-hidden border border-[var(--color-rule)]"
        style={{ height }}
      >
        {slices.map(({ book, width }) => {
          const dim =
            highlightBookId !== null && highlightBookId !== book.id
              ? "opacity-40"
              : "";
          return (
            <button
              key={book.id}
              type="button"
              title={`${book.name} — ${book.chapters} ch`}
              onMouseEnter={() => onHoverBook?.(book.id)}
              onMouseLeave={() => onHoverBook?.(null)}
              onClick={() => onSelectBook?.(book.id)}
              className={cn(
                "relative h-full shrink-0 border-r border-[var(--color-rule)]/60 transition-opacity last:border-r-0",
                SECTION_TINT[book.section],
                dim,
                "hover:brightness-95",
              )}
              style={{ width: `${width * 100}%` }}
            />
          );
        })}
      </div>

      {!hideLabels && (
        <div className="relative mt-1 h-3 w-full text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]">
          {slices.map(({ book, width }, i) => {
            // Render a label only if there's at least ~14 px of horizontal
            // room for the abbreviation. Below that we drop it to avoid the
            // collapsed "JonMicNah…" mess at the minor-prophet end.
            const minWidthForLabel = 0.012; // ~1.2% of viewport
            if (width < minWidthForLabel) return null;
            return (
              <span
                key={book.id}
                className="absolute -translate-x-1/2 truncate"
                style={{
                  left: `${
                    slices.slice(0, i).reduce((s, x) => s + x.width, 0) * 100 +
                    width * 50
                  }%`,
                }}
              >
                {book.abbr}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
