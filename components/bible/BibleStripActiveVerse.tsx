"use client";

import { useMemo } from "react";
import { makeXMapper } from "@/lib/bible/bibleXAxis";
import { STRONGS_DOT_BASELINE_INSET } from "@/lib/bible/strongsVerseDotHitTest";

interface BibleStripActiveVerseProps {
  width: number;
  height: number;
  activeIdx: number;
}

/**
 * Baseline + active-verse dot for bible-strip bands. Rendered whenever the
 * passage index is known, independent of Strong's dots or xref spokes.
 */
export function BibleStripActiveVerse({
  width,
  height,
  activeIdx,
}: BibleStripActiveVerseProps) {
  const xOf = useMemo(() => makeXMapper(width, "word"), [width]);
  if (width <= 0 || height <= 0) return null;

  const baseline = height - STRONGS_DOT_BASELINE_INSET;
  const xActive = xOf(activeIdx);

  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <line
        x1={0}
        y1={baseline}
        x2={width}
        y2={baseline}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <circle
        cx={xActive}
        cy={baseline}
        r={3}
        className="fill-[var(--color-ink)]"
      />
    </svg>
  );
}
