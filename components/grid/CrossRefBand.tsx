"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CrossRefPopup, type VerseRef } from "@/components/bible/CrossRefPopup";
import { CrossRefDetailSheet } from "@/components/bible/CrossRefDetailSheet";
import {
  VerseCrossRefSpokes,
  type VerseCrossRefSpokeHover,
} from "@/components/bible/VerseCrossRefSpokes";
import { BibleStripActiveVerse } from "@/components/bible/BibleStripActiveVerse";
import { bookById } from "@/lib/bible/books";
import { useStableVerseIndex } from "@/lib/bible/useStableVerseIndex";
import {
  DEFAULT_XREF_VARIANT,
  countVerseCrossRefs,
  loadCrossReferences,
} from "@/lib/bible/xrefsClient";
import type { VerseCrossRefSpoke } from "@/lib/bible/verseCrossRefSpokes";
import { useGridStore } from "@/lib/grid/state";
import {
  BIBLE_STRIP_BAND_HEIGHT,
  BIBLE_STRIP_LABEL_ROW_PX,
  BIBLE_STRIP_TRACK_HEIGHT_PX,
  bibleStripBandClassName,
  bibleStripBandStyle,
} from "@/lib/grid/bibleStripBand";

/** @deprecated Use BIBLE_STRIP_BAND_HEIGHT — kept for existing imports. */
export const CROSS_REF_SPOKE_HEIGHT = BIBLE_STRIP_BAND_HEIGHT;

const XREF_TOOLTIP_MIN_WIDTH = 180;
const VIEWPORT_PAD = 8;
const TOOLTIP_GAP_PX = 8;

function formatRef(ref: VerseRef): string {
  const b = bookById(ref.book);
  return `${b?.abbr ?? ref.book} ${ref.chapter}:${ref.verse}`;
}

function orderedRefs(
  spoke: VerseCrossRefSpoke,
  activeIdx: number,
): { from: VerseRef; to: VerseRef } {
  const activeIsFrom = spoke.fromIdx === activeIdx;
  const from = activeIsFrom ? spoke.fromRef : spoke.toRef;
  const to = activeIsFrom ? spoke.toRef : spoke.fromRef;
  return {
    from: { book: from.book, chapter: from.chapter, verse: from.verse },
    to: { book: to.book, chapter: to.chapter, verse: to.verse },
  };
}

/**
 * Cross-reference spokes for the active BibleReader verse. Sits above
 * BooksLane; the spoke baseline aligns with the bottom edge of this band.
 */
export function CrossRefBand() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [pairs, setPairs] = useState<Uint32Array | null>(null);
  const [xrefCount, setXrefCount] = useState(0);
  const [hoverSpoke, setHoverSpoke] = useState<VerseCrossRefSpoke | null>(
    null,
  );
  const [hoverPointer, setHoverPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [clickedSpoke, setClickedSpoke] = useState<VerseCrossRefSpoke | null>(
    null,
  );
  const [detailSpoke, setDetailSpoke] = useState<VerseCrossRefSpoke | null>(
    null,
  );
  const translationId = useGridStore((s) => s.bibleTranslationId);
  const currentBibleRef = useGridStore((s) => s.currentBibleRef);

  const handleSpokeHover = useCallback((info: VerseCrossRefSpokeHover | null) => {
    if (!info) {
      setHoverSpoke(null);
      setHoverPointer(null);
      return;
    }
    setHoverSpoke(info.spoke);
    setHoverPointer({ x: info.clientX, y: info.clientY });
  }, []);

  const displayVerseIndex = useStableVerseIndex(currentBibleRef);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    loadCrossReferences(DEFAULT_XREF_VARIANT).then((d) => {
      if (!alive) return;
      setPairs(d.pairs);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (displayVerseIndex == null || !pairs) {
      setXrefCount(0);
      setHoverSpoke(null);
      setHoverPointer(null);
      setClickedSpoke(null);
      setDetailSpoke(null);
      return;
    }
    setXrefCount(countVerseCrossRefs(pairs, displayVerseIndex));
  }, [displayVerseIndex, pairs]);

  const tooltip = useMemo(() => {
    if (!hoverSpoke || displayVerseIndex == null) return null;
    const { from, to } = orderedRefs(hoverSpoke, displayVerseIndex);
    return {
      from: formatRef(from),
      to: formatRef(to),
      distance: Math.abs(hoverSpoke.toIdx - hoverSpoke.fromIdx),
    };
  }, [hoverSpoke, displayVerseIndex]);

  const clickedRefs = useMemo(() => {
    if (!clickedSpoke || displayVerseIndex == null) return null;
    return orderedRefs(clickedSpoke, displayVerseIndex);
  }, [clickedSpoke, displayVerseIndex]);

  const detailRefs = useMemo(() => {
    if (!detailSpoke || displayVerseIndex == null) return null;
    return orderedRefs(detailSpoke, displayVerseIndex);
  }, [detailSpoke, displayVerseIndex]);

  const refLabel = currentBibleRef
    ? (() => {
        const b = bookById(currentBibleRef.book);
        const v = currentBibleRef.verseStart ?? 1;
        return `${b?.abbr ?? currentBibleRef.book} ${currentBibleRef.chapter}:${v}`;
      })()
    : "";

  return (
    <>
      <div
        ref={hostRef}
        className={bibleStripBandClassName}
        style={bibleStripBandStyle()}
        aria-label="Cross-references"
      >
        <div
          className="pointer-events-none absolute inset-x-2 top-0 z-10 flex items-center overflow-hidden text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]"
          style={{ height: BIBLE_STRIP_LABEL_ROW_PX }}
        >
          <span className="truncate">
            {xrefCount} xref{xrefCount === 1 ? "" : "s"}
            {refLabel ? ` · ${refLabel}` : ""}
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
          {width > 0 && pairs && displayVerseIndex != null && xrefCount > 0 && (
            <VerseCrossRefSpokes
              width={width}
              height={BIBLE_STRIP_TRACK_HEIGHT_PX}
              activeIdx={displayVerseIndex}
              pairs={pairs}
              onHover={handleSpokeHover}
              onClick={(spoke) => {
                setClickedSpoke(spoke);
                setHoverSpoke(null);
                setHoverPointer(null);
              }}
            />
          )}

          {displayVerseIndex != null && xrefCount === 0 && pairs && (
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]/90">
              No cross-references for this verse
            </div>
          )}
        </div>

        {tooltip &&
          hoverPointer &&
          !clickedSpoke &&
          typeof document !== "undefined" &&
          createPortal(
            (() => {
              const vw = window.innerWidth;
              const left = Math.max(
                VIEWPORT_PAD,
                Math.min(
                  vw - XREF_TOOLTIP_MIN_WIDTH - VIEWPORT_PAD,
                  hoverPointer.x - XREF_TOOLTIP_MIN_WIDTH / 2,
                ),
              );
              return (
                <div
                  className="pointer-events-none fixed z-50 -translate-y-full rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-2 py-1.5 text-xs shadow-md"
                  style={{
                    left,
                    top: hoverPointer.y - TOOLTIP_GAP_PX,
                    minWidth: XREF_TOOLTIP_MIN_WIDTH,
                  }}
                  role="tooltip"
                >
                  <div className="font-semibold">
                    {tooltip.from}{" "}
                    <span className="text-[var(--color-ink-2)]">↔</span>{" "}
                    {tooltip.to}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
                    span: {tooltip.distance.toLocaleString()} verses
                  </div>
                </div>
              );
            })(),
            document.body,
          )}

        {clickedRefs && clickedSpoke && (
          <CrossRefPopup
            from={clickedRefs.from}
            to={clickedRefs.to}
            anchor={{ x: width / 2, y: BIBLE_STRIP_TRACK_HEIGHT_PX / 2 }}
            bounds={{ width, height: BIBLE_STRIP_TRACK_HEIGHT_PX }}
            viewportAnchor={
              hostRef.current
                ? {
                    x:
                      hostRef.current.getBoundingClientRect().left +
                      width / 2,
                    y: hostRef.current.getBoundingClientRect().top + 8,
                  }
                : undefined
            }
            translationId={translationId}
            onClose={() => setClickedSpoke(null)}
            onOpenDetail={() => {
              setDetailSpoke(clickedSpoke);
              setClickedSpoke(null);
            }}
          />
        )}
      </div>

      <CrossRefDetailSheet
        from={detailRefs?.from ?? null}
        to={detailRefs?.to ?? null}
        translationId={translationId}
        onClose={() => setDetailSpoke(null)}
      />
    </>
  );
}
