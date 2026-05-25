"use client";

import { bookById } from "@/lib/bible/books";
import { useChapter } from "./useChapter";
import { cn } from "@/lib/utils";

export interface VerseRef {
  book: string;
  chapter: number;
  verse: number;
}

interface VersePreviewProps {
  ref_: VerseRef;
  translationId: string;
}

/** Inline verse reference + plain text for a single verse in the chosen translation. */
export function VersePreview({ ref_, translationId }: VersePreviewProps) {
  const { data, isLoading, error } = useChapter(
    ref_.book,
    ref_.chapter,
    translationId,
  );
  const verse = data?.verses?.find((v) => v.verse === ref_.verse);
  const book = bookById(ref_.book);
  return (
    <div>
      <div className="font-serif text-sm font-semibold text-[var(--color-ink)]">
        {book?.name ?? ref_.book} {ref_.chapter}:{ref_.verse}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm leading-relaxed text-[var(--color-ink)]",
          (isLoading || error || !verse) && "italic text-[var(--color-ink-2)]",
        )}
      >
        {isLoading
          ? "Loading…"
          : error
            ? "Couldn't load verse text."
            : verse
              ? verse.plain
              : data?.configMissing
                ? "Bible provider not configured."
                : "Verse not found."}
      </div>
    </div>
  );
}
