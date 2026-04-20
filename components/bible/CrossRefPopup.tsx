"use client";

import { useEffect, useRef } from "react";
import { bookById } from "@/lib/bible/books";
import { useChapter } from "./useChapter";
import { cn } from "@/lib/utils";

export interface VerseRef {
  book: string;
  chapter: number;
  verse: number;
}

interface CrossRefPopupProps {
  from: VerseRef;
  to: VerseRef;
  /** Click position (relative to the arcs host) so we can anchor the card. */
  anchor: { x: number; y: number };
  /** Pixel bounds available for placement (usually the arcs container size). */
  bounds: { width: number; height: number };
  translationId: string;
  onClose(): void;
  onOpenDetail(): void;
}

/**
 * Small floating card anchored near the click point. Shows both sides of the
 * cross-reference with inline verse text, plus a "View detail →" button that
 * escalates to the full slide-out sheet.
 *
 * The popup does its own light-weight viewport clamping; it deliberately
 * does NOT portal out to `document.body` because the atlas page is a
 * dedicated full-viewport canvas — z-index inside the host is enough.
 */
export function CrossRefPopup({
  from,
  to,
  anchor,
  bounds,
  translationId,
  onClose,
  onOpenDetail,
}: CrossRefPopupProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click and on Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // mousedown (not click) so the same click that lands on another arc
    // closes this popup before opening the next one.
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Placement: prefer the card above-right of the click; flip to stay inside.
  const cardW = 340;
  const cardH = 220;
  const pad = 8;
  const left = Math.max(
    pad,
    Math.min(bounds.width - cardW - pad, anchor.x - cardW / 2),
  );
  const top =
    anchor.y - cardH - 16 >= pad
      ? anchor.y - cardH - 16
      : Math.min(bounds.height - cardH - pad, anchor.y + 16);

  return (
    <div
      ref={ref}
      className="absolute z-20 w-[340px] rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] shadow-xl"
      style={{ left, top }}
      role="dialog"
      aria-label="Cross-reference"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
          Cross-reference
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full px-2 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
        >
          ×
        </button>
      </div>

      <div className="max-h-[260px] overflow-y-auto px-3 py-2">
        <VersePreview ref_={from} translationId={translationId} />
        <div className="my-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
          <span className="h-px flex-1 bg-[var(--color-rule)]" />
          <span>↔</span>
          <span className="h-px flex-1 bg-[var(--color-rule)]" />
        </div>
        <VersePreview ref_={to} translationId={translationId} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-rule)] px-3 py-2">
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--color-paper)] hover:opacity-90"
        >
          View detail →
        </button>
      </div>
    </div>
  );
}

function VersePreview({
  ref_,
  translationId,
}: {
  ref_: VerseRef;
  translationId: string;
}) {
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
