"use client";

import { useEffect, useMemo, useState } from "react";
import { useGridStore } from "@/lib/grid/state";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import type { BibleRef, Dot } from "@/lib/grid/types";

interface ConnectorOverlayProps {
  /** The element whose top-left is the (0,0) of our SVG canvas. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  dots: Dot[];
  hoverDotId: string | null;
  hoverBookId: string | null;
  /** Set externally (e.g. via a book click) — keeps connectors visible. */
  selectedBookId: string | null;
  /** Persistently draw a connector for every (dot, ref) pair. */
  showAll?: boolean;
}

interface Edge {
  key: string;
  dotId: string;
  bookId: string;
  /** Strength in [0,1] driving stroke opacity / width — higher = more emphasis. */
  weight: number;
  /** Specific reference; lets the book-end anchor estimate where in the book to land. */
  ref?: BibleRef;
}

const CHAPTERS_BY_BOOK: Map<string, number> = new Map(
  BIBLE_BOOKS.map((b) => [b.id, b.chapters]),
);

/**
 * Estimate where inside a book bar a reference points to, returned as a
 * fraction in [0,1] (0 = book start, 1 = book end). We don't carry per-chapter
 * verse counts, so a chapter is treated as a uniform slice of the book and the
 * verse, when supplied, is positioned within that slice using a coarse
 * "verses per chapter" guess. This is intentionally rough — the book bar is
 * narrow and we just need the line to lean toward the right end of the book.
 */
function refFraction(bookId: string, ref?: BibleRef): number {
  if (!ref) return 0.5;
  const chapters = CHAPTERS_BY_BOOK.get(bookId);
  if (!chapters || chapters <= 0) return 0.5;
  const chapter = Math.max(1, Math.min(chapters, ref.chapter || 1));
  const VERSES_PER_CHAPTER_GUESS = 30;
  let verseFrac = 0.5;
  if (ref.verseStart && ref.verseStart > 0) {
    const start = ref.verseStart;
    const end = ref.verseEnd && ref.verseEnd >= start ? ref.verseEnd : start;
    const mid = (start + end) / 2;
    verseFrac = Math.max(
      0,
      Math.min(1, (mid - 0.5) / VERSES_PER_CHAPTER_GUESS),
    );
  }
  return (chapter - 1 + verseFrac) / chapters;
}

interface Anchor {
  x: number;
  y: number;
}

/**
 * Draws curved bezier connectors from dots up to the BooksLane book segments
 * they reference. We compute geometry from live DOM rects (querying
 * `[data-dot-id]` and `[data-book-id]`) so the overlay always tracks the
 * current pan/zoom without us having to rebuild a coordinate system.
 *
 * The overlay lives at the GridCanvas level and is purely decorative —
 * pointer-events: none — so hovering through it never blocks dot/book clicks.
 */
export function ConnectorOverlay({
  containerRef,
  dots,
  hoverDotId,
  hoverBookId,
  selectedBookId,
  showAll = false,
}: ConnectorOverlayProps) {
  // We trigger a re-measure on a "tick" anytime layout could have changed.
  // Pan/zoom from the store are obvious triggers; ResizeObserver covers
  // window resizes; the hovered ids themselves trigger a recompute via deps.
  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const centerDate = useGridStore((s) => s.centerDate);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setTick((t) => t + 1);
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [containerRef]);

  // Pan / zoom changes mean dot x positions move — re-measure.
  useEffect(() => {
    setTick((t) => t + 1);
  }, [pxPerDay, centerDate]);

  // Which (dotId, bookId) pairs should we draw?
  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    if (showAll) {
      // Persistent: every (dot, ref) pair across the visible dot set.
      for (const d of dots) {
        const seenBooks = new Set<string>();
        for (const r of d.refs) {
          if (seenBooks.has(r.book)) continue;
          seenBooks.add(r.book);
          list.push({
            key: `all:${d.id}->${r.book}`,
            dotId: d.id,
            bookId: r.book,
            weight: 0.5,
            ref: r,
          });
        }
      }
    }
    if (selectedBookId) {
      // Persistent: every visible dot referencing the selected book.
      for (const d of dots) {
        const ref = d.refs.find((r) => r.book === selectedBookId);
        if (ref) {
          list.push({
            key: `${d.id}->${selectedBookId}`,
            dotId: d.id,
            bookId: selectedBookId,
            weight: 0.85,
            ref,
          });
        }
      }
    }
    if (hoverDotId) {
      const d = dots.find((x) => x.id === hoverDotId);
      if (d) {
        for (const r of d.refs) {
          list.push({
            key: `${d.id}->${r.book}`,
            dotId: d.id,
            bookId: r.book,
            weight: 1,
            ref: r,
          });
        }
      }
    }
    if (hoverBookId) {
      for (const d of dots) {
        const ref = d.refs.find((r) => r.book === hoverBookId);
        if (ref) {
          list.push({
            key: `${d.id}->${hoverBookId}`,
            dotId: d.id,
            bookId: hoverBookId,
            weight: 0.9,
            ref,
          });
        }
      }
    }
    // Dedupe by key (hovers can overlap with selection / show-all).
    const seen = new Set<string>();
    return list.filter((e) =>
      seen.has(e.key) ? false : (seen.add(e.key), true),
    );
  }, [dots, hoverDotId, hoverBookId, selectedBookId, showAll]);

  const paths = useMemo(() => {
    if (edges.length === 0) return [];
    const container = containerRef.current;
    if (!container) return [];
    const cRect = container.getBoundingClientRect();

    const dotAnchor = (dotId: string): Anchor | null => {
      const el = container.querySelector<HTMLElement>(
        `[data-dot-id="${dotId}"]`,
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - cRect.left,
        y: r.top + r.height / 2 - cRect.top,
      };
    };
    const bookAnchor = (bookId: string, ref?: BibleRef): Anchor | null => {
      const el = container.querySelector<HTMLElement>(
        `[data-book-id="${bookId}"]`,
      );
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Inset slightly so anchors near chapter 1 / final chapter don't sit
      // exactly on the book divider (which would visually attribute them to
      // the neighbor).
      const INSET_PX = 1.5;
      const usable = Math.max(0, r.width - INSET_PX * 2);
      const frac = refFraction(bookId, ref);
      return {
        x: r.left + INSET_PX + usable * frac - cRect.left,
        y: r.bottom - cRect.top, // anchor at the bottom edge of the book bar
      };
    };

    return edges.flatMap((e) => {
      const a = dotAnchor(e.dotId);
      const b = bookAnchor(e.bookId, e.ref);
      if (!a || !b) return [];
      // Bezier with control points pulled vertically toward the midpoint, so
      // the line eases out of the dot upward and into the book bar from below.
      const dy = a.y - b.y;
      const c1y = a.y - dy * 0.55;
      const c2y = b.y + dy * 0.55;
      const d = `M ${a.x} ${a.y} C ${a.x} ${c1y}, ${b.x} ${c2y}, ${b.x} ${b.y}`;
      return [
        {
          key: e.key,
          d,
          weight: e.weight,
          ax: a.x,
          ay: a.y,
          bx: b.x,
          by: b.y,
        },
      ];
    });
  }, [edges, containerRef, size, tick]);

  if (size.w === 0 || size.h === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="connector-gradient" x1="0" y1="0" x2="0" y2="1">
          {/* Top (book end) — book-bar ink color, faint. */}
          <stop offset="0%" stopColor="var(--color-ink)" stopOpacity="0.85" />
          {/* Bottom (dot end) — slightly stronger so the dot side reads. */}
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {paths.map((p) => (
        <g key={p.key}>
          <path
            d={p.d}
            fill="none"
            stroke="url(#connector-gradient)"
            strokeWidth={1 + p.weight * 0.75}
            strokeLinecap="round"
            opacity={0.35 + p.weight * 0.5}
          />
          {/* Tiny ring at the book end so it visually "lands" on the bar. */}
          <circle cx={p.bx} cy={p.by} r={2.5} fill="var(--color-ink)" opacity={0.65} />
        </g>
      ))}
    </svg>
  );
}
