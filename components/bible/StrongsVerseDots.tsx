"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { makeXMapper, type XAxisMode } from "@/lib/bible/bibleXAxis";
import {
  hitTestStrongsVerseDot,
  STRONGS_DOT_ROW_HEIGHT_PX,
  strongsVerseDotY,
} from "@/lib/bible/strongsVerseDotHitTest";

const PIXEL_RATIO_CAP = 2;
const DOT_ALPHA = 0.42;
const DOT_SIZE = 3;
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const xOf = useMemo(() => makeXMapper(width, xMode), [width, xMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const dpr = Math.min(PIXEL_RATIO_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const dotY = strongsVerseDotY(height);
    const half = DOT_SIZE / 2;

    ctx.fillStyle = "var(--color-ink)";

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i]!;
      const x = xOf(idx);
      ctx.globalAlpha = DOT_ALPHA;
      ctx.fillRect(x - half, dotY - half, DOT_SIZE, DOT_SIZE);
    }
  }, [width, height, indices, xOf]);

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

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />
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
