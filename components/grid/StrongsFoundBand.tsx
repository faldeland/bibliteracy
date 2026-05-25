"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BibleStripActiveVerse } from "@/components/bible/BibleStripActiveVerse";
import {
  StrongsVerseDots,
  type StrongsVerseDotHover,
} from "@/components/bible/StrongsVerseDots";
import { VerseHoverCard } from "@/components/bible/VerseHoverCard";
import type { VerseRef } from "@/components/bible/VersePreview";
import { bookById } from "@/lib/bible/books";
import { EMPTY_VERSE_INDICES } from "@/lib/bible/emptyIndices";
import { verseFromIndex } from "@/lib/bible/globalVerseIndex";
import { useStableVerseIndex } from "@/lib/bible/useStableVerseIndex";
import { loadStrongsOccurrences } from "@/lib/bible/strongsClient";
import {
  BIBLE_STRIP_LABEL_ROW_PX,
  BIBLE_STRIP_TRACK_HEIGHT_PX,
  bibleStripBandClassName,
  bibleStripBandStyle,
} from "@/lib/grid/bibleStripBand";
import { useGridStore } from "@/lib/grid/state";

/** @deprecated Use BIBLE_STRIP_BAND_HEIGHT from bibleStripBand — kept for imports. */
export { BIBLE_STRIP_BAND_HEIGHT as STRONGS_FOUND_BAND_HEIGHT } from "@/lib/grid/bibleStripBand";

/**
 * Strong's occurrence strip above BooksLane. Always visible at a fixed
 * height; active-verse marker never unmounts during navigation.
 */
export function StrongsFoundBand() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [indices, setIndices] = useState<Uint32Array>(EMPTY_VERSE_INDICES);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hoverDot, setHoverDot] = useState<StrongsVerseDotHover | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const highlightStrong = useGridStore((s) => s.highlightStrong);
  const pinnedStrong = useGridStore((s) => s.pinnedStrong);
  const setPinnedStrong = useGridStore((s) => s.setPinnedStrong);
  const activeStrong = pinnedStrong ?? highlightStrong;
  const currentBibleRef = useGridStore((s) => s.currentBibleRef);
  const translationId = useGridStore((s) => s.bibleTranslationId);
  const navigateBible = useGridStore((s) => s.navigateBible);
  const displayVerseIndex = useStableVerseIndex(currentBibleRef);

  const hoverVerseRef = useMemo((): VerseRef | null => {
    if (!hoverDot) return null;
    const ref = verseFromIndex(hoverDot.verseIndex);
    if (!ref) return null;
    return { book: ref.book, chapter: ref.chapter, verse: ref.verse };
  }, [hoverDot]);

  const handleVerseClick = useCallback(
    (verseIdx: number) => {
      const ref = verseFromIndex(verseIdx);
      if (!ref) return;
      if (activeStrong) setPinnedStrong(activeStrong);
      navigateBible({
        book: ref.book,
        chapter: ref.chapter,
        verseStart: ref.verse,
      });
    },
    [activeStrong, navigateBible, setPinnedStrong],
  );

  const updateTooltipAnchor = useCallback((dot: StrongsVerseDotHover | null) => {
    setHoverDot(dot);
    const host = trackRef.current;
    if (!dot || !host) {
      setTooltipAnchor(null);
      return;
    }
    const rect = host.getBoundingClientRect();
    setTooltipAnchor({ x: rect.left + dot.x, y: rect.top });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!activeStrong) {
      setIndices(EMPTY_VERSE_INDICES);
      setCount(0);
      setLoading(false);
      setHoverDot(null);
      setTooltipAnchor(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setHoverDot(null);
    setTooltipAnchor(null);
    loadStrongsOccurrences(activeStrong)
      .then((data) => {
        if (!alive) return;
        setIndices(data.indices);
        setCount(data.count);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setIndices(EMPTY_VERSE_INDICES);
        setCount(0);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeStrong]);

  const refLabel = currentBibleRef
    ? (() => {
        const b = bookById(currentBibleRef.book);
        const v = currentBibleRef.verseStart ?? 1;
        return `${b?.abbr ?? currentBibleRef.book} ${currentBibleRef.chapter}:${v}`;
      })()
    : "";

  const strongLabel = useMemo(() => {
    if (!activeStrong) return null;
    if (loading) return `${activeStrong} · …`;
    if (count === 0) return `${activeStrong} · none`;
    return `${count.toLocaleString()} verse${count === 1 ? "" : "s"} · ${activeStrong}`;
  }, [activeStrong, loading, count]);

  const trackMessage = useMemo(() => {
    if (!activeStrong) return "Hover a Strong's number in the reader";
    if (loading) return "Loading occurrences…";
    if (count === 0) return "No KJV occurrences";
    return null;
  }, [activeStrong, loading, count]);

  return (
    <div
      ref={hostRef}
      className={bibleStripBandClassName}
      style={bibleStripBandStyle()}
      aria-label="Strong's occurrences"
    >
      <div
        className="pointer-events-none absolute inset-x-2 top-0 z-10 flex items-center overflow-hidden text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]"
        style={{ height: BIBLE_STRIP_LABEL_ROW_PX }}
      >
        <span className="truncate">
          {strongLabel ?? (refLabel || "\u00a0")}
        </span>
      </div>

      <div
        ref={trackRef}
        className="absolute inset-x-0 bottom-0"
        style={{ height: BIBLE_STRIP_TRACK_HEIGHT_PX }}
      >
        {width > 0 && displayVerseIndex != null && (
          <BibleStripActiveVerse
            width={width}
            height={BIBLE_STRIP_TRACK_HEIGHT_PX}
            activeIdx={displayVerseIndex}
          />
        )}
        {width > 0 && activeStrong && (
          <StrongsVerseDots
            width={width}
            height={BIBLE_STRIP_TRACK_HEIGHT_PX}
            xMode="word"
            indices={indices}
            onHover={updateTooltipAnchor}
            onVerseClick={handleVerseClick}
          />
        )}
        {trackMessage && (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]/90">
            {trackMessage}
          </div>
        )}
      </div>

      {hoverVerseRef && tooltipAnchor && (
        <VerseHoverCard
          ref_={hoverVerseRef}
          translationId={translationId}
          viewportAnchor={tooltipAnchor}
        />
      )}
    </div>
  );
}
