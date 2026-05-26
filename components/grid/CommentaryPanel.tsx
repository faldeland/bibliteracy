"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bookById } from "@/lib/bible/books";
import { fetchCommentaryChapterFromApi } from "@/lib/bible/commentaryApiClient";
import {
  COMMENTARY_SOURCES,
  DEFAULT_COMMENTARY_SOURCE_ID,
} from "@/lib/bible/commentarySources";
import {
  commentaryVersesInRange,
  type CommentaryView,
} from "@/lib/bible/commentaryView";
import { useGridStore } from "@/lib/grid/state";
import { cn } from "@/lib/utils";

const COMMENTARY_SOURCE_STORAGE_KEY = "bibliteracy:commentary:sourceId";

function formatVerseRange(verseStart: number, verseEnd: number): string {
  if (verseEnd <= verseStart) return String(verseStart);
  return `${verseStart}–${verseEnd}`;
}

/** Commentary for the passage shown in BibleReader (via grid `currentBibleRef`). */
export function CommentaryPanel() {
  const currentBibleRef = useGridStore((s) => s.currentBibleRef);
  const [sourceId, setSourceId] = useState(DEFAULT_COMMENTARY_SOURCE_ID);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CommentaryView | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COMMENTARY_SOURCE_STORAGE_KEY);
      if (stored && COMMENTARY_SOURCES.some((s) => s.id === stored)) {
        setSourceId(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const selectSource = useCallback((id: string) => {
    setSourceId(id);
    try {
      window.localStorage.setItem(COMMENTARY_SOURCE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const ref = currentBibleRef;
  const book = ref ? bookById(ref.book) : undefined;
  const verseStart = ref?.verseStart ?? ref?.verseEnd ?? 1;
  const verseEnd = ref?.verseEnd ?? ref?.verseStart ?? verseStart;
  const refBook = ref?.book;
  const refChapter = ref?.chapter;

  useEffect(() => {
    if (!refBook || !refChapter || !book) {
      setView(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ctl = new AbortController();
    setLoading(true);
    setError(null);

    void fetchCommentaryChapterFromApi(
      refBook,
      refChapter,
      sourceId,
      ctl.signal,
    )
      .then((res) => {
        if (ctl.signal.aborted) return;
        if (res.error || !res.view) {
          setView(null);
          setError(res.error ?? "Commentary unavailable for this chapter.");
          return;
        }
        setView(res.view);
        setError(null);
      })
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setView(null);
        setError(
          e instanceof Error ? e.message : "Could not load commentary.",
        );
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });

    return () => ctl.abort();
  }, [refBook, refChapter, book, sourceId]);

  const verses = useMemo(() => {
    if (!view) return [];
    return commentaryVersesInRange(view.verses, verseStart, verseEnd);
  }, [view, verseStart, verseEnd]);

  if (!ref || !book) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
        <p className="text-sm text-[var(--color-ink-2)]">
          Open a passage in the reader to see commentary here.
        </p>
      </div>
    );
  }

  const heading = `${book.name} ${ref.chapter}:${formatVerseRange(verseStart, verseEnd)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2">
        <div
          className="mb-2 flex flex-wrap gap-1"
          role="group"
          aria-label="Commentary source"
        >
          {COMMENTARY_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSource(s.id)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors",
                sourceId === s.id
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-2)]/50 hover:text-[var(--color-ink)]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-serif text-sm font-medium text-[var(--color-ink)]">
            {heading}
          </span>
          <span className="text-[10px] text-[var(--color-ink-2)]">
            via{" "}
            <a
              href={view?.attributionUrl ?? "https://bible.helloao.org/"}
              className="underline decoration-[var(--color-rule)] underline-offset-2 hover:decoration-[var(--color-ink)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {view?.attributionLabel ?? "Free Use Bible API"}
            </a>
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <p className="text-sm text-[var(--color-ink-2)]">Loading commentary…</p>
        )}
        {error && !loading && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {error}
          </p>
        )}
        {!loading && !error && (
          <>
            {view?.chapterIntroduction && verseStart === 1 && (
              <section className="mb-4 border-b border-[var(--color-rule)]/60 pb-4">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                  Chapter introduction
                </h3>
                <CommentaryBody text={view.chapterIntroduction} />
              </section>
            )}
            {verses.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-2)]">
                No commentary for {heading} in this source.
              </p>
            ) : (
              <ul className="space-y-4">
                {verses.map(({ verse, text }) => (
                  <li key={verse}>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                      Verse {verse}
                    </div>
                    <CommentaryBody text={text} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CommentaryBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  return (
    <div className="space-y-3 font-serif text-[13px] leading-relaxed text-[var(--color-ink)]">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  );
}
