"use client";

import { useEffect } from "react";
import { bookById } from "@/lib/bible/books";
import { useChapter } from "./useChapter";
import type { VerseRef } from "./CrossRefPopup";
import { cn } from "@/lib/utils";

interface CrossRefDetailSheetProps {
  from: VerseRef | null;
  to: VerseRef | null;
  translationId: string;
  onClose(): void;
}

/**
 * Full-height slide-out panel showing both sides of a cross-reference with a
 * few verses of surrounding context. Matches the look of `DotSheet` from the
 * grid view so the whole app feels consistent when a right-hand detail
 * drawer slides in.
 */
export function CrossRefDetailSheet({
  from,
  to,
  translationId,
  onClose,
}: CrossRefDetailSheetProps) {
  const open = !!from && !!to;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md bg-[var(--color-paper)] shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {from && to && (
          <CrossRefDetailView
            key={`${from.book}${from.chapter}:${from.verse}-${to.book}${to.chapter}:${to.verse}`}
            from={from}
            to={to}
            translationId={translationId}
            onClose={onClose}
          />
        )}
      </aside>
    </>
  );
}

function CrossRefDetailView({
  from,
  to,
  translationId,
  onClose,
}: {
  from: VerseRef;
  to: VerseRef;
  translationId: string;
  onClose(): void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between border-b border-[var(--color-rule)] px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Cross-reference · {translationId}
          </div>
          <h2 className="mt-1 font-serif text-xl text-[var(--color-ink)]">
            {formatRef(from)}{" "}
            <span className="text-[var(--color-ink-2)]">↔</span>{" "}
            {formatRef(to)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
        >
          Close
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        <VerseContext ref_={from} translationId={translationId} />
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
          <span className="h-px flex-1 bg-[var(--color-rule)]" />
          <span>↔</span>
          <span className="h-px flex-1 bg-[var(--color-rule)]" />
        </div>
        <VerseContext ref_={to} translationId={translationId} />
      </div>
    </div>
  );
}

/** Pull ±2 verses of surrounding context and highlight the target verse. */
function VerseContext({
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
  const book = bookById(ref_.book);

  if (isLoading) {
    return (
      <section>
        <Heading ref_={ref_} />
        <p className="mt-1 text-sm italic text-[var(--color-ink-2)]">
          Loading…
        </p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        <Heading ref_={ref_} />
        <p className="mt-1 text-sm italic text-rose-700">
          Couldn&apos;t load chapter text: {(error as Error).message}
        </p>
      </section>
    );
  }
  const verses = data?.verses ?? [];
  if (verses.length === 0) {
    return (
      <section>
        <Heading ref_={ref_} />
        <p className="mt-1 text-sm italic text-[var(--color-ink-2)]">
          {data?.configMissing
            ? "Bible provider not configured."
            : "No chapter text available."}
        </p>
      </section>
    );
  }

  // Show two verses on either side for context — enough to locate the verse
  // without turning the drawer into a full-chapter reader.
  const ctxBefore = 2;
  const ctxAfter = 2;
  const shown = verses.filter(
    (v) => v.verse >= ref_.verse - ctxBefore && v.verse <= ref_.verse + ctxAfter,
  );

  return (
    <section>
      <Heading ref_={ref_} />
      <div className="mt-2 space-y-1 text-sm leading-relaxed text-[var(--color-ink)]">
        {shown.map((v) => {
          const isTarget = v.verse === ref_.verse;
          return (
            <p
              key={v.verse}
              className={cn(
                "rounded px-1",
                isTarget
                  ? "bg-[var(--color-today)]/25 font-medium text-[var(--color-ink)]"
                  : "text-[var(--color-ink-2)]",
              )}
            >
              <sup className="mr-1 text-[10px] font-semibold tracking-widest text-[var(--color-ink-2)]">
                {v.verse}
              </sup>
              {v.plain}
            </p>
          );
        })}
      </div>
      {book && data?.attribution && (
        <div className="mt-1 text-[10px] text-[var(--color-ink-2)]">
          {data.attribution}
        </div>
      )}
    </section>
  );
}

function Heading({ ref_ }: { ref_: VerseRef }) {
  const book = bookById(ref_.book);
  return (
    <div className="font-serif text-base font-semibold text-[var(--color-ink)]">
      {book?.name ?? ref_.book} {ref_.chapter}:{ref_.verse}
    </div>
  );
}

function formatRef(r: VerseRef): string {
  const b = bookById(r.book);
  return `${b?.abbr ?? r.book} ${r.chapter}:${r.verse}`;
}
