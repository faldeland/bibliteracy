"use client";

import { useEffect, useRef, useState } from "react";
import { useChapter } from "@/components/bible/useChapter";
import type { VerseRef } from "@/components/bible/VersePreview";
import { bookById } from "@/lib/bible/books";
import { cn } from "@/lib/utils";

interface StrongsOccurrenceRowProps {
  ref_: VerseRef;
  translationId: string;
  fallbackLabel: string;
  onClick(): void;
}

/** One concordance hit: reference + plain text in the reader's translation. */
export function StrongsOccurrenceRow({
  ref_,
  translationId,
  fallbackLabel,
  onClick,
}: StrongsOccurrenceRowProps) {
  const liRef = useRef<HTMLLIElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = liRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { data, isLoading, error } = useChapter(
    ref_.book,
    ref_.chapter,
    translationId,
    inView,
  );
  const verse = data?.verses?.find((v) => v.verse === ref_.verse);
  const book = bookById(ref_.book);
  const heading = `${book?.abbr ?? ref_.book} ${ref_.chapter}:${ref_.verse}`;

  let body: string;
  if (!inView) {
    body = "";
  } else if (isLoading) {
    body = "Loading…";
  } else if (error) {
    body = "Couldn't load verse text.";
  } else if (verse) {
    body = verse.plain;
  } else if (data?.configMissing) {
    body = "Bible provider not configured.";
  } else {
    body = "";
  }

  return (
    <li ref={liRef}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "block w-full px-3 py-2 text-left",
          "hover:bg-black/[0.04]",
        )}
      >
        <div className="font-serif text-[13px] font-semibold text-[var(--color-ink)]">
          {heading}
        </div>
        {(inView ? body : fallbackLabel) ? (
          <div
            className={cn(
              "mt-0.5 text-[12px] leading-relaxed text-[var(--color-ink)]",
              (!inView || isLoading || error) &&
                "italic text-[var(--color-ink-2)]",
            )}
          >
            {inView ? body || fallbackLabel : fallbackLabel}
          </div>
        ) : null}
      </button>
    </li>
  );
}
