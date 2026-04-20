"use client";

import { useMemo } from "react";
import {
  BIBLE_BOOKS,
  SECTION_ORDER,
  TOTAL_BIBLE_WORDS,
  sectionWords,
  type BibleBook,
  type TanakhSection,
} from "@/lib/bible/books";
import { useGridStore } from "@/lib/grid/state";
import { cn } from "@/lib/utils";
import type { Dot } from "@/lib/grid/types";

const SECTION_TINT: Record<TanakhSection, string> = {
  Torah: "bg-amber-100/70",
  "Nevi'im": "bg-orange-100/70",
  Ketuvim: "bg-yellow-100/70",
  Gospels: "bg-emerald-100/70",
  Acts: "bg-teal-100/70",
  Pauline: "bg-sky-100/70",
  General: "bg-indigo-100/70",
  Revelation: "bg-rose-100/70",
};

interface BooksLaneProps {
  /** All visible dots (used to compute reference density per book). */
  dots?: Dot[];
  /** Hover callbacks for the connector overlay. */
  onHoverBook?: (bookId: string | null) => void;
}

export function BooksLane({ dots = [], onHoverBook }: BooksLaneProps) {
  const selectedBookId = useGridStore((s) => s.selectedBookId);
  const setSelectedBookId = useGridStore((s) => s.setSelectedBookId);

  // Reference density: how many dots reference each book.
  const refCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dots) {
      for (const r of d.refs) {
        m.set(r.book, (m.get(r.book) ?? 0) + 1);
      }
    }
    return m;
  }, [dots]);

  const maxRefs = useMemo(
    () => Math.max(1, ...Array.from(refCount.values())),
    [refCount],
  );

  // Group books by section so we can render section headers above them.
  // The section's viewport-percentage is sectionWords / TOTAL_BIBLE_WORDS, and
  // each book inside is sized as a percentage of *its section* (not of the
  // whole Bible). Because the section already has the right total width, this
  // composes to: bookViewportPct = (book.words / sectionWords) * (sectionWords
  // / TOTAL_BIBLE_WORDS) = book.words / TOTAL_BIBLE_WORDS — exactly correct.
  const sections = useMemo(() => {
    return SECTION_ORDER.map((section) => {
      const books = BIBLE_BOOKS.filter((b) => b.section === section);
      const totalSectionWords = sectionWords(section);
      const widthPct = (totalSectionWords / TOTAL_BIBLE_WORDS) * 100;
      return { section, books, widthPct, totalSectionWords };
    });
  }, []);

  return (
    <div className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60">
      {/* Section header row */}
      <div className="flex h-5 w-full text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
        {sections.map(({ section, widthPct }) => (
          <div
            key={section}
            className="flex items-center justify-center border-r border-[var(--color-rule)] last:border-r-0"
            style={{ width: `${widthPct}%` }}
            title={section}
          >
            <span className="truncate px-1">{section}</span>
          </div>
        ))}
      </div>

      {/* Books row */}
      <div className="flex h-12 w-full">
        {sections.map(({ section, books, widthPct, totalSectionWords }) => (
          <div
            key={section}
            className={cn("flex h-full", SECTION_TINT[section])}
            style={{ width: `${widthPct}%` }}
          >
            {books.map((b) => (
              <BookSegment
                key={b.id}
                book={b}
                widthInSectionPct={(b.words / totalSectionWords) * 100}
                selected={selectedBookId === b.id}
                density={(refCount.get(b.id) ?? 0) / maxRefs}
                refs={refCount.get(b.id) ?? 0}
                onSelect={() =>
                  setSelectedBookId(selectedBookId === b.id ? null : b.id)
                }
                onHover={onHoverBook}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookSegment({
  book,
  widthInSectionPct,
  selected,
  density,
  refs,
  onSelect,
  onHover,
}: {
  book: BibleBook;
  /** Width of this book as a percentage of its section (NOT of the viewport). */
  widthInSectionPct: number;
  selected: boolean;
  density: number;
  refs: number;
  onSelect: () => void;
  onHover?: (bookId: string | null) => void;
}) {
  const viewportPct = (book.words / TOTAL_BIBLE_WORDS) * 100;
  const titleSuffix = refs > 0 ? ` · ${refs} ref${refs === 1 ? "" : "s"}` : "";
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover?.(book.id)}
      onMouseLeave={() => onHover?.(null)}
      data-book-id={book.id}
      title={`${book.name} — ${book.chapters} ch, ${book.words.toLocaleString()} words (${viewportPct.toFixed(2)}% of Bible)${titleSuffix}`}
      className={cn(
        "group relative flex h-full shrink-0 items-end justify-center overflow-hidden border-r border-[var(--color-rule)]/70 px-0.5 pb-1 text-[10px] font-medium text-[var(--color-ink)] transition-colors last:border-r-0",
        "hover:bg-black/5",
        selected && "bg-[var(--color-ink)]/90 text-[var(--color-paper)]",
      )}
      style={{ width: `${widthInSectionPct}%`, minWidth: 0 }}
    >
      {/* Density bar at the bottom */}
      {density > 0 && !selected && (
        <span
          className="pointer-events-none absolute bottom-0 left-0 right-0 bg-[var(--color-ink)]"
          style={{ height: `${Math.max(2, density * 16)}px`, opacity: 0.18 + density * 0.5 }}
        />
      )}
      <span className="relative truncate leading-none">{book.abbr}</span>
    </button>
  );
}
