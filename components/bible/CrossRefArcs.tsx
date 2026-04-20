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
import { BIBLE_BOOKS } from "@/lib/bible/books";
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

// ── Layout: verse-uniform x ───────────────────────────────────────────────
//
// On the standalone /atlas page we want to honor Harrison's original
// layout: every verse takes the same width, so the bar chart of book
// lengths underneath has the proportions that made the image iconic.
// (BooksLane elsewhere in the app uses a word-proportional layout; that
// layout is exposed via the `xMode="word"` prop for the embedded
// mini-strip in BibleReader, where consistency matters more than fidelity
// to the poster.)

export type XAxisMode = "verse" | "word";

function makeXMapper(width: number, mode: XAxisMode): (idx: number) => number {
  if (mode === "verse") {
    return (idx: number) => (idx / TOTAL_VERSES) * width;
  }
  // Word-proportional: walk the books in canonical order, map each book's
  // verse range linearly onto its proportional pixel slice.
  const totalWords = BIBLE_BOOKS.reduce((s, b) => s + b.words, 0);
  type Slice = { start: number; end: number; xStart: number; xEnd: number };
  const slices: Slice[] = [];
  let xCursor = 0;
  for (const b of BIBLE_BOOKS) {
    const r = bookRange(b.id);
    if (!r) continue;
    const w = (b.words / totalWords) * width;
    slices.push({ start: r.start, end: r.end, xStart: xCursor, xEnd: xCursor + w });
    xCursor += w;
  }
  return (idx: number) => {
    // Slices are contiguous and in order, so a linear scan dominated by
    // the cache is cheaper than binary search for our access patterns
    // (we render in input order, which is roughly canonical).
    for (const s of slices) {
      if (idx < s.end) {
        const t = (idx - s.start) / (s.end - s.start);
        return s.xStart + t * (s.xEnd - s.xStart);
      }
    }
    return width;
  };
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
  onHoverArc,
  onClickArc,
}: CrossRefArcsProps) {
  // Whenever any kind of highlight is active, the background firehose
  // becomes scaffolding rather than the subject — we dim it via CSS so we
  // don't have to rerender the (expensive) base canvas on every hover.
  const isHighlighting = highlightVerseIndex != null || !!highlightBookId;
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
  }, [data, width, height, xMode, xRange]);

  // Highlight pass: redraw only arcs touching the active highlight (either a
  // single verse or every verse inside a hovered book). Lives on a separate
  // canvas so the firehose isn't repainted on every hover.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !data || width <= 0 || height <= 0) return;
    const dpr = Math.min(PIXEL_RATIO_CAP, window.devicePixelRatio || 1);
    overlay.width = Math.round(width * dpr);
    overlay.height = Math.round(height * dpr);
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (highlightVerseIndex == null && !highlightBookId) return;

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

    const xOf = makeXMapper(width, xMode);
    const baseline = height - BASELINE_PADDING;
    const maxRadius = baseline;

    // Book-scoped highlights can cover thousands of arcs; a single
    // globalAlpha produces readable density. Verse-scoped is usually tiny,
    // so a brighter alpha is fine.
    ctx.globalAlpha = bookR ? 0.55 : HIGHLIGHT_ALPHA;
    ctx.lineWidth = bookR ? 0.5 : 0.8;

    const pairs = data.pairs;
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
  }, [data, width, height, xMode, highlightVerseIndex, highlightBookId]);

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
    // When a book is hovered, only arcs with an endpoint inside that book
    // are visible — restrict the hit-test to the same set so the tooltip
    // never describes an arc the user can't actually see.
    const bookR = highlightBookId ? bookRange(highlightBookId) : null;
    const pairs = data.pairs;
    let bestResidual = 6;
    let bestIdx = -1;
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i];
      const b = pairs[i + 1];
      if (
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
        className="absolute inset-0 transition-opacity duration-150"
        style={{ opacity: isHighlighting ? BASE_FADE_ALPHA : 1 }}
      />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0"
      />
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest text-[var(--color-ink-2)]">
          Loading {variant === "recognized" ? "recognized" : "all"}{" "}
          cross-references…
        </div>
      )}
    </div>
  );
}
