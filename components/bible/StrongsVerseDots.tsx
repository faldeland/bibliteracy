"use client";

import { useCallback, useMemo, useRef } from "react";
import { makeXMapper, type XAxisMode } from "@/lib/bible/bibleXAxis";
import {
  hitTestStrongsVerseDot,
  STRONGS_DOT_ROW_HEIGHT_PX,
  strongsVerseDotY,
} from "@/lib/bible/strongsVerseDotHitTest";

/** Odd CSS px size, snapped to integer centers. */
const DOT_SIZE = 3;
const DOT_HALF = (DOT_SIZE - 1) / 2;

export interface StrongsVerseDotHover {
  verseIndex: number;
  /** Local x within the band (px). */
  x: number;
}

interface StrongsVerseDotsProps {
  width: number;
  height: number;
  xMode?: XAxisMode;
  /** Global verse indices (canon order). */
  indices: Uint32Array;
  onHover?: (info: StrongsVerseDotHover | null) => void;
  /** Fired when the user clicks a dot (global verse index). */
  onVerseClick?: (verseIndex: number) => void;
}

/** One 3×3 px square per occurrence, merged into a single path for perf. */
function buildDotsPath(
  indices: Uint32Array,
  xOf: (idx: number) => number,
  dotY: number,
): string {
  if (indices.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const x = Math.round(xOf(indices[i]!));
    const left = x - DOT_HALF;
    const top = dotY - DOT_HALF;
    parts.push(`M${left},${top}h${DOT_SIZE}v${DOT_SIZE}h${-DOT_SIZE}z`);
  }
  return parts.join("");
}

/**
 * Renders one dot per verse on the word-proportional bible strip (same x-axis
 * as BooksLane and CrossRefBand).
 */
export function StrongsVerseDots({
  width,
  height,
  xMode = "word",
  indices,
  onHover,
  onVerseClick,
}: StrongsVerseDotsProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const xOf = useMemo(() => makeXMapper(width, xMode), [width, xMode]);
  const dotY = Math.round(strongsVerseDotY(height));
  const dotsPath = useMemo(
    () => buildDotsPath(indices, xOf, dotY),
    [indices, xOf, dotY],
  );

  const hitTestAt = useCallback(
    (clientX: number, clientY: number) => {
      const host = hostRef.current;
      if (!host) return null;
      const rect = host.getBoundingClientRect();
      return hitTestStrongsVerseDot(
        clientX - rect.left,
        clientY - rect.top,
        width,
        height,
        indices,
        xOf,
      );
    },
    [width, height, indices, xOf],
  );

  const runHoverTest = useCallback(
    (clientX: number, clientY: number) => {
      if (!onHover) return;
      const hit = hitTestAt(clientX, clientY);
      if (hit == null) {
        onHover(null);
        return;
      }
      onHover({ verseIndex: hit, x: xOf(hit) });
    },
    [hitTestAt, onHover, xOf],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      runHoverTest(e.clientX, e.clientY);
    },
    [runHoverTest],
  );

  const onPointerLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onVerseClick) return;
      const hit = hitTestAt(e.clientX, e.clientY);
      if (hit != null) onVerseClick(hit);
    },
    [hitTestAt, onVerseClick],
  );

  const interactive = !!(onHover || onVerseClick);

  if (width <= 0 || height <= 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{ width, height }}
    >
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
      >
        {dotsPath && (
          <path
            d={dotsPath}
            className="fill-[var(--color-ink)]"
            shapeRendering="crispEdges"
          />
        )}
      </svg>
      {interactive && (
        <div
          ref={hostRef}
          className="pointer-events-auto absolute inset-x-0 top-0 cursor-pointer"
          style={{ height: STRONGS_DOT_ROW_HEIGHT_PX }}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        />
      )}
    </div>
  );
}
