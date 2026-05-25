"use client";

import { useEffect, useRef, useState } from "react";
import {
  TOTAL_VERSES,
  bookRange,
  verseFromIndex,
} from "@/lib/bible/globalVerseIndex";

// When a book is hovered, fade the background firehose to this alpha so the
// book-scoped overlay reads as the foreground without actually hiding the
// poster entirely (0.06 is enough to still sense the shape underneath).
const BASE_FADE_ALPHA = 0.08;
import { makeXMapper, type XAxisMode } from "@/lib/bible/bibleXAxis";
import {
  DEFAULT_XREF_VARIANT,
  loadCrossReferences,
  type XRefData,
  type XRefVariant,
} from "@/lib/bible/xrefsClient";
import { cn } from "@/lib/utils";

// ── Rendering parameters ──────────────────────────────────────────────────
//
// Harrison's iconic poster colors each arc by canonical distance — short
// hops (intra-book) red, long hops (Genesis ↔ Revelation) violet. We
// pre-compute a 256-entry HSL ramp keyed on distance and look it up per
// arc. Alpha is intentionally low (0.18) so dense regions glow rather
// than fight each other; in practice ~340k arcs at α=0.18 produces the
// signature "rainbow over the books" look.

const RAMP_SIZE = 256;
const ARC_ALPHA = 0.18;
const HIGHLIGHT_ALPHA = 0.95;
const BASELINE_PADDING = 2; // gap (px) between arc baseline and bottom edge
const PIXEL_RATIO_CAP = 2; // cap DPR so absurdly-high-DPI screens stay fast

function buildColorRamp(): string[] {
  const out = new Array<string>(RAMP_SIZE);
  for (let i = 0; i < RAMP_SIZE; i++) {
    // Hue sweeps red → violet across canonical distance.
    const hue = Math.round((i / (RAMP_SIZE - 1)) * 280);
    out[i] = `hsl(${hue}deg 80% 50%)`;
  }
  return out;
}

const COLOR_RAMP = buildColorRamp();

function rampColor(distance: number): string {
  // Distance is normalized against TOTAL_VERSES so the longest possible arc
  // (Gen 1:1 ↔ Rev 22:21) lands at the violet end.
  const t = Math.min(1, distance / TOTAL_VERSES);
  return COLOR_RAMP[Math.min(RAMP_SIZE - 1, Math.floor(t * RAMP_SIZE))];
}

export type { XAxisMode } from "@/lib/bible/bibleXAxis";

// ── Verse-only spokes (compact band above BooksLane) ───────────────────────
//
// Harrison semicircles need radius = half the horizontal span. In a ~52 px
// band that radius is capped, so long cross-references no longer touch either
// endpoint on the baseline — they look like random floating bumps. Spokes
// always connect the active verse to each target with a bezier curve.

function spokeCurveHeight(baseline: number): number {
  return Math.max(8, baseline - 4);
}

function distToSpoke(
  cx: number,
  cy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cpY: number,
): number {
  let best = Infinity;
  for (let s = 0; s <= 24; s += 1) {
    const t = s / 24;
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x0 + 3 * u * t * t * x1 + t * t * t * x1;
    const y = u * u * u * y0 + 3 * u * u * t * cpY + 3 * u * t * t * cpY + t * t * t * y1;
    const d = Math.hypot(cx - x, cy - y);
    if (d < best) best = d;
  }
  return best;
}

function drawVerseSpokes(
  ctx: CanvasRenderingContext2D,
  pairs: Uint32Array,
  highlightVerseIndex: number,
  xOf: (idx: number) => number,
  baseline: number,
  width: number,
): void {
  const xActive = xOf(highlightVerseIndex);
  const cpY = baseline - spokeCurveHeight(baseline);

  ctx.strokeStyle = "var(--color-rule)";
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baseline);
  ctx.lineTo(width, baseline);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1];
    const targetIdx =
      a === highlightVerseIndex ? b : b === highlightVerseIndex ? a : null;
    if (targetIdx == null) continue;

    const xTarget = xOf(targetIdx);
    const dist = Math.abs(targetIdx - highlightVerseIndex);
    ctx.strokeStyle = rampColor(dist);
    ctx.globalAlpha = HIGHLIGHT_ALPHA;
    ctx.beginPath();
    ctx.moveTo(xActive, baseline);
    ctx.bezierCurveTo(xActive, cpY, xTarget, cpY, xTarget, baseline);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = rampColor(dist);
    ctx.beginPath();
    ctx.arc(xTarget, baseline, 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = "var(--color-ink)";
  ctx.beginPath();
  ctx.arc(xActive, baseline, 4, 0, 2 * Math.PI);
  ctx.fill();
}

// ── Component ─────────────────────────────────────────────────────────────

interface CrossRefArcsProps {
  width: number;
  height: number;
  /** Layout mode for the x-axis. Defaults to verse-uniform (poster mode). */
  xMode?: XAxisMode;
  /**
   * Which cross-reference dataset to draw. Defaults to "recognized" — the
   * 63,779 high-confidence Harrison/Römhild core. Pass "all" to draw the
   * full ~343k-arc firehose.
   */
  variant?: XRefVariant;
  /**
   * If set, only arcs touching this verse index get drawn at full opacity;
   * everything else fades to a faint background. Set to null/undefined to
   * show the full firehose.
   */
  highlightVerseIndex?: number | null;
  /**
   * If set, only arcs with at least one endpoint inside this book's global
   * verse range are drawn; the rest of the firehose fades to the background.
   * When both `highlightVerseIndex` and `highlightBookId` are set, the verse
   * takes precedence (it's strictly more specific).
   */
  highlightBookId?: string | null;
  /**
   * Hide every arc whose midpoint lies outside this normalized x-range
   * [0, 1]. Useful if we ever want a lensed/zoomed view; for now it stays
   * unset.
   */
  xRange?: [number, number];
  /**
   * When a highlight is active, skip the background firehose entirely
   * instead of fading it — useful for the compact band above BooksLane.
   */
  hideBaseWhenHighlighting?: boolean;
  /** Called when the user hovers an arc. */
  onHoverArc?: (info: ArcHoverInfo | null) => void;
  /** Called when the user clicks an arc (same hit-test rules as hover). */
  onClickArc?: (info: ArcHoverInfo) => void;
}

export interface ArcHoverInfo {
  fromIdx: number;
  toIdx: number;
  fromRef: { book: string; chapter: number; verse: number };
  toRef: { book: string; chapter: number; verse: number };
  /** Pixel position relative to the canvas, for tooltip placement. */
  x: number;
  y: number;
}

export function CrossRefArcs({
  width,
  height,
  xMode = "verse",
  variant = DEFAULT_XREF_VARIANT,
  highlightVerseIndex = null,
  highlightBookId = null,
  xRange,
  hideBaseWhenHighlighting = false,
  onHoverArc,
  onClickArc,
}: CrossRefArcsProps) {
  // Whenever any kind of highlight is active, the background firehose
  // becomes scaffolding rather than the subject — we dim it via CSS so we
  // don't have to rerender the (expensive) base canvas on every hover.
  const isHighlighting = highlightVerseIndex != null || !!highlightBookId;
  // Verse-only mode: draw just the active verse's arcs — no firehose at all.
  const verseOnly =
    hideBaseWhenHighlighting &&
    highlightVerseIndex != null &&
    !highlightBookId;
  const skipBase = verseOnly;
  const baseOpacity =
    hideBaseWhenHighlighting && isHighlighting
      ? 0
      : isHighlighting
        ? BASE_FADE_ALPHA
        : 1;
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<XRefData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    // Clear the stale dataset while swapping variants so the overlay +
    // hit-testing don't briefly describe arcs that aren't on screen.
    setData(null);
    loadCrossReferences(variant)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e as Error);
      });
    return () => {
      alive = false;
    };
  }, [variant]);

  // Draw the firehose into the base canvas. Re-runs only when the data,
  // the dimensions, or the layout mode change — NOT on hover.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas || !data || width <= 0 || height <= 0 || skipBase) return;
    const dpr = Math.min(PIXEL_RATIO_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const xOf = makeXMapper(width, xMode);
    const baseline = height - BASELINE_PADDING;
    const maxRadius = baseline; // never let arcs leak above the canvas top

    const xMin = xRange ? xRange[0] * width : 0;
    const xMax = xRange ? xRange[1] * width : width;

    ctx.globalAlpha = ARC_ALPHA;
    ctx.lineWidth = 0.35;

    // Group arcs by ramp bucket so we change strokeStyle ~256 times instead
    // of ~340k times. ~3× faster on Chrome / Safari in informal benchmarks.
    const bucketed: number[][] = Array.from({ length: RAMP_SIZE }, () => []);
    const pairs = data.pairs;
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i];
      const b = pairs[i + 1];
      const dist = Math.abs(b - a);
      const bucket = Math.min(
        RAMP_SIZE - 1,
        Math.floor((dist / TOTAL_VERSES) * RAMP_SIZE),
      );
      bucketed[bucket].push(i);
    }

    for (let bucket = 0; bucket < RAMP_SIZE; bucket++) {
      const indices = bucketed[bucket];
      if (indices.length === 0) continue;
      ctx.strokeStyle = COLOR_RAMP[bucket];
      ctx.beginPath();
      for (const i of indices) {
        const a = pairs[i];
        const b = pairs[i + 1];
        const xa = xOf(a);
        const xb = xOf(b);
        const mid = (xa + xb) / 2;
        if (mid < xMin || mid > xMax) continue;
        const r = Math.min(maxRadius, Math.abs(xb - xa) / 2);
        ctx.moveTo(mid - r, baseline);
        ctx.arc(mid, baseline, r, Math.PI, 2 * Math.PI);
      }
      ctx.stroke();
    }
  }, [data, width, height, xMode, xRange, skipBase]);

  // Highlight pass: redraw only arcs touching the active highlight (either a
  // single verse or every verse inside a hovered book). In verse-only mode
  // this is the sole canvas — the firehose base is never drawn.
  useEffect(() => {
    const canvas = verseOnly ? baseRef.current : overlayRef.current;
    if (!canvas || !data || width <= 0 || height <= 0) return;
    const dpr = Math.min(PIXEL_RATIO_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!verseOnly && highlightVerseIndex == null && !highlightBookId) return;

    // Verse takes precedence — it's the stricter filter. If a book is
    // hovered instead, fall back to its [start, end) range.
    const bookR =
      highlightVerseIndex == null && highlightBookId
        ? bookRange(highlightBookId)
        : null;
    const hits = (a: number, b: number): boolean => {
      if (highlightVerseIndex != null) {
        return a === highlightVerseIndex || b === highlightVerseIndex;
      }
      if (bookR) {
        return (
          (a >= bookR.start && a < bookR.end) ||
          (b >= bookR.start && b < bookR.end)
        );
      }
      return false;
    };

    const pairs = data.pairs;
    const xOf = makeXMapper(width, xMode);
    const baseline = height - BASELINE_PADDING;

    if (verseOnly && highlightVerseIndex != null) {
      drawVerseSpokes(ctx, pairs, highlightVerseIndex, xOf, baseline, width);
      return;
    }

    const maxRadius = baseline;

    // Book-scoped highlights can cover thousands of arcs; a single
    // globalAlpha produces readable density. Verse-scoped is usually tiny,
    // so a brighter alpha is fine.
    ctx.globalAlpha = bookR ? 0.55 : HIGHLIGHT_ALPHA;
    ctx.lineWidth = bookR ? 0.5 : 0.8;

    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i];
      const b = pairs[i + 1];
      if (!hits(a, b)) continue;
      const xa = xOf(a);
      const xb = xOf(b);
      const mid = (xa + xb) / 2;
      const r = Math.min(maxRadius, Math.abs(xb - xa) / 2);
      ctx.strokeStyle = rampColor(Math.abs(b - a));
      ctx.beginPath();
      ctx.arc(mid, baseline, r, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
  }, [
    data,
    width,
    height,
    xMode,
    highlightVerseIndex,
    highlightBookId,
    verseOnly,
  ]);

  // Shared hit-test. Cheaper than full pixel-perfect picking: find the
  // nearest arc whose baseline-vertex distance to the cursor is small.
  // Arcs are half-circles centered on `mid` with radius `r`, so the
  // distance from the cursor to the arc is `||cursor - mid|| - r|` for
  // y < baseline. We pick the smallest such residual within a 6 px
  // tolerance, which feels right interactively. Returns `null` when the
  // cursor is below the baseline or no arc is close enough.
  function hitTest(
    host: HTMLElement,
    clientX: number,
    clientY: number,
  ): ArcHoverInfo | null {
    if (!data) return null;
    const rect = host.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const baseline = height - BASELINE_PADDING;
    if (cy > baseline) return null;
    const xOf = makeXMapper(width, xMode);
    const pairs = data.pairs;
    const cpY = baseline - spokeCurveHeight(baseline);
    let bestResidual = 8;
    let bestIdx = -1;

    if (verseOnly && highlightVerseIndex != null) {
      const xActive = xOf(highlightVerseIndex);
      for (let i = 0; i < pairs.length; i += 2) {
        const a = pairs[i];
        const b = pairs[i + 1];
        if (a !== highlightVerseIndex && b !== highlightVerseIndex) continue;
        const targetIdx = a === highlightVerseIndex ? b : a;
        const xTarget = xOf(targetIdx);
        const residual = distToSpoke(
          cx,
          cy,
          xActive,
          baseline,
          xTarget,
          baseline,
          cpY,
        );
        if (residual < bestResidual) {
          bestResidual = residual;
          bestIdx = i;
        }
      }
    } else {
    // When a book is hovered, only arcs with an endpoint inside that book
    // are visible — restrict the hit-test to the same set so the tooltip
    // never describes an arc the user can't actually see.
    const bookR = highlightBookId ? bookRange(highlightBookId) : null;
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i];
      const b = pairs[i + 1];
      if (highlightVerseIndex != null) {
        if (a !== highlightVerseIndex && b !== highlightVerseIndex) continue;
      } else if (
        bookR &&
        !(
          (a >= bookR.start && a < bookR.end) ||
          (b >= bookR.start && b < bookR.end)
        )
      ) {
        continue;
      }
      const xa = xOf(a);
      const xb = xOf(b);
      const mid = (xa + xb) / 2;
      const r = Math.abs(xb - xa) / 2;
      if (r < 1) continue;
      if (cx < mid - r || cx > mid + r) continue;
      if (cy < baseline - r) continue;
      const dx = cx - mid;
      const dy = cy - baseline;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const residual = Math.abs(dist - r);
      if (residual < bestResidual) {
        bestResidual = residual;
        bestIdx = i;
      }
    }
    }
    if (bestIdx === -1) return null;
    const a = pairs[bestIdx];
    const b = pairs[bestIdx + 1];
    const fromRef = verseFromIndex(a);
    const toRef = verseFromIndex(b);
    if (!fromRef || !toRef) return null;
    return { fromIdx: a, toIdx: b, fromRef, toRef, x: cx, y: cy };
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!onHoverArc) return;
    onHoverArc(hitTest(e.currentTarget, e.clientX, e.clientY));
  }

  function onLeave() {
    onHoverArc?.(null);
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onClickArc) return;
    const hit = hitTest(e.currentTarget, e.clientX, e.clientY);
    if (hit) onClickArc(hit);
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-rose-600">
        Failed to load cross-references: {error.message}
      </div>
    );
  }

  return (
    <div
      className={cn("relative", onClickArc && "cursor-pointer")}
      style={{ width, height }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
    >
      <canvas
        ref={baseRef}
        className={cn(
          "absolute inset-0",
          !verseOnly && "transition-opacity duration-150",
        )}
        style={{ opacity: verseOnly ? 1 : baseOpacity }}
      />
      {!verseOnly && (
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0"
        />
      )}
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-[var(--color-ink-2)]">
          Loading {variant === "recognized" ? "recognized" : "all"}{" "}
          cross-references…
        </div>
      )}
    </div>
  );
}
