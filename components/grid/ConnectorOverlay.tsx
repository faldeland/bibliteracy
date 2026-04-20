"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGridStore } from "@/lib/grid/state";
import {
  buildConnectorEdges,
  refFraction,
  type ConnectorEdge,
} from "@/lib/grid/connectors";
import type { BibleRef, Dot } from "@/lib/grid/types";

interface ConnectorOverlayProps {
  /** The element whose top-left is the (0,0) of our SVG canvas. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  dots: Dot[];
  hoverDotId: string | null;
  hoverBookId: string | null;
  selectedBookId: string | null;
  showAll?: boolean;
}

interface Anchor {
  x: number;
  y: number;
}

/**
 * Draws curved bezier connectors from dots up to the BooksLane book segments
 * they reference.
 *
 * Performance notes:
 * - Edge selection is a pure function in lib/grid/connectors.ts.
 * - Each measurement tick collects every `[data-dot-id]` / `[data-book-id]`
 *   element via TWO `querySelectorAll` calls (instead of one per edge),
 *   builds Maps keyed by id, and looks up from there while building paths.
 * - Pan / zoom / resize re-measures are coalesced into a single rAF frame.
 */
export function ConnectorOverlay({
  containerRef,
  dots,
  hoverDotId,
  hoverBookId,
  selectedBookId,
  showAll = false,
}: ConnectorOverlayProps) {
  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const centerDate = useGridStore((s) => s.centerDate);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);

  // rAF-coalesced tick bumps. Multiple triggers inside the same frame (e.g.
  // ResizeObserver + pan) collapse into one re-measure.
  const rafRef = useRef<number | null>(null);
  const bumpTick = useMemo(
    () => () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setTick((t) => t + 1);
      });
    },
    [],
  );
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      bumpTick();
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [containerRef, bumpTick]);

  // Pan / zoom changes mean dot x positions move — re-measure.
  useEffect(() => {
    bumpTick();
  }, [pxPerDay, centerDate, bumpTick]);

  const edges = useMemo<ConnectorEdge[]>(
    () =>
      buildConnectorEdges({
        dots,
        hoverDotId,
        hoverBookId,
        selectedBookId,
        showAll,
      }),
    [dots, hoverDotId, hoverBookId, selectedBookId, showAll],
  );

  const paths = useMemo(() => {
    if (edges.length === 0) return [];
    const container = containerRef.current;
    if (!container) return [];
    const cRect = container.getBoundingClientRect();

    // Build id -> element maps ONCE per measurement tick, then look up from
    // there. This replaces N `querySelector` calls with 2 `querySelectorAll`
    // calls, which is decisive when `showAll` is on.
    const dotEls = new Map<string, HTMLElement>();
    container
      .querySelectorAll<HTMLElement>("[data-dot-id]")
      .forEach((el) => {
        const id = el.dataset.dotId;
        if (id) dotEls.set(id, el);
      });
    const bookEls = new Map<string, HTMLElement>();
    container
      .querySelectorAll<HTMLElement>("[data-book-id]")
      .forEach((el) => {
        const id = el.dataset.bookId;
        if (id) bookEls.set(id, el);
      });

    const dotAnchor = (dotId: string): Anchor | null => {
      const el = dotEls.get(dotId);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - cRect.left,
        y: r.top + r.height / 2 - cRect.top,
      };
    };
    const bookAnchor = (bookId: string, ref?: BibleRef): Anchor | null => {
      const el = bookEls.get(bookId);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const INSET_PX = 1.5;
      const usable = Math.max(0, r.width - INSET_PX * 2);
      const frac = refFraction(bookId, ref);
      return {
        x: r.left + INSET_PX + usable * frac - cRect.left,
        y: r.bottom - cRect.top,
      };
    };

    return edges.flatMap((e) => {
      const a = dotAnchor(e.dotId);
      const b = bookAnchor(e.bookId, e.ref);
      if (!a || !b) return [];
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
    // `size` and `tick` are read indirectly via DOM rects, so the linter
    // can't see the dependency — keep them to force re-measurement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <stop offset="0%" stopColor="var(--color-ink)" stopOpacity="0.85" />
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
          <circle cx={p.bx} cy={p.by} r={2.5} fill="var(--color-ink)" opacity={0.65} />
        </g>
      ))}
    </svg>
  );
}
