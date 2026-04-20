"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BibleReader } from "./BibleReader";
import { BooksLane } from "./BooksLane";
import { TimeRuler } from "./TimeRuler";
import { Lane } from "./Lane";
import { DotSheet } from "./DotSheet";
import { NewDotComposer } from "./NewDotComposer";
import { ConnectorOverlay } from "./ConnectorOverlay";
import { useGridStore } from "@/lib/grid/state";
import { zoomLevelFor, ZOOM_PX_PER_DAY, type ZoomLevel } from "@/lib/grid/time";
import type { Dot, DotKind } from "@/lib/grid/types";
import type { DotUpdate, NewDotInput } from "@/lib/grid/dotsApi";

const ACCENT: Record<DotKind, string> = {
  logos: "var(--color-logos)",
  prayer: "var(--color-prayer)",
  discipleship: "var(--color-discipleship)",
};

const LANE_TITLE: Record<DotKind, string> = {
  logos: "Logos + Rhema",
  prayer: "Prayer",
  discipleship: "Discipleship",
};

interface GridCanvasProps {
  dots: Dot[];
  /** Display label for the current user (name or email). */
  displayName?: string | null;
  onCreateDot(d: NewDotInput): void;
  onUpdateDot?(id: string, patch: DotUpdate): void;
  onDeleteDot?(id: string): void;
}

export function GridCanvas({
  dots,
  displayName,
  onCreateDot,
  onUpdateDot,
  onDeleteDot,
}: GridCanvasProps) {
  const panRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const panByPx = useGridStore((s) => s.panByPx);
  const zoomAt = useGridStore((s) => s.zoomAt);
  const recenterOnToday = useGridStore((s) => s.recenterOnToday);
  const setZoom = useGridStore((s) => s.setZoom);

  // Track viewport width.
  useEffect(() => {
    const el = panRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setViewportWidth(e.contentRect.width);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Pan via pointer drag — accumulate sub-pixel deltas so slow drags don't
  // round-trip to zero.
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    accum: number;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Don't start a pan if the press originates on an interactive control
    // (Add button, day cell, dot, etc.) — capturing the pointer here would
    // redirect the click event away from those buttons and they'd appear
    // to do nothing.
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, input, textarea, select, label, [role="button"]',
      )
    ) {
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, lastX: e.clientX, accum: 0 };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      drag.accum -= dx; // dragging right = pan into the past
      const pxPerDayNow = useGridStore.getState().pxPerDay;
      const dayPx = pxPerDayNow;
      if (Math.abs(drag.accum) >= dayPx) {
        const days = Math.trunc(drag.accum / dayPx);
        panByPx(days * dayPx);
        drag.accum -= days * dayPx;
      }
    },
    [panByPx],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, []);

  // Wheel: Cmd/Ctrl+wheel zooms; horizontal/regular wheel pans.
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const el = panRef.current;
      if (!el) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cursorPx = e.clientX - rect.left;
        const factor = Math.exp(-e.deltaY * 0.0025);
        zoomAt({
          newPxPerDay: useGridStore.getState().pxPerDay * factor,
          cursorPx,
          viewportPx: rect.width,
        });
      } else {
        const dx = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX || e.deltaY
          : e.deltaY;
        panByPx(dx);
      }
    },
    [zoomAt, panByPx],
  );

  // Wheel listener with passive:false so we can preventDefault on Cmd+wheel.
  useEffect(() => {
    const el = panRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) ev.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Keyboard: arrows pan, +/- zoom, T = today.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      const px = useGridStore.getState().pxPerDay;
      if (e.key === "ArrowLeft") panByPx(-px * 7);
      else if (e.key === "ArrowRight") panByPx(px * 7);
      else if (e.key === "+" || e.key === "=") {
        const rect = panRef.current?.getBoundingClientRect();
        if (rect) zoomAt({ newPxPerDay: px * 1.25, cursorPx: rect.width / 2, viewportPx: rect.width });
      } else if (e.key === "-" || e.key === "_") {
        const rect = panRef.current?.getBoundingClientRect();
        if (rect) zoomAt({ newPxPerDay: px / 1.25, cursorPx: rect.width / 2, viewportPx: rect.width });
      } else if (e.key === "t" || e.key === "T") {
        recenterOnToday();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panByPx, zoomAt, recenterOnToday]);

  const [activeDotId, setActiveDotId] = useState<string | null>(null);
  const activeDot = useMemo(
    () => (activeDotId ? dots.find((d) => d.id === activeDotId) ?? null : null),
    [activeDotId, dots],
  );
  const [composer, setComposer] = useState<{ kind: DotKind; date: Date } | null>(
    null,
  );
  const [hoverDotId, setHoverDotId] = useState<string | null>(null);
  const [hoverBookId, setHoverBookId] = useState<string | null>(null);
  const [showAllConnectors, setShowAllConnectors] = useState(false);
  const overlayHostRef = useRef<HTMLDivElement | null>(null);

  const currentZoom = useMemo(() => zoomLevelFor(pxPerDay), [pxPerDay]);
  const selectedBookId = useGridStore((s) => s.selectedBookId);
  const setSelectedBookId = useGridStore((s) => s.setSelectedBookId);

  const filteredDots = useMemo(() => {
    if (!selectedBookId) return dots;
    return dots.filter((d) => d.refs.some((r) => r.book === selectedBookId));
  }, [dots, selectedBookId]);

  const handleOpenDot = useCallback((d: Dot) => setActiveDotId(d.id), []);
  const handleCloseSheet = useCallback(() => setActiveDotId(null), []);
  const handleDeleteDot = useMemo(() => {
    if (!onDeleteDot) return undefined;
    return (id: string) => {
      onDeleteDot(id);
      setActiveDotId(null);
    };
  }, [onDeleteDot]);
  const addLogos = useCallback(
    (date: Date) => setComposer({ kind: "logos", date }),
    [],
  );
  const addPrayer = useCallback(
    (date: Date) => setComposer({ kind: "prayer", date }),
    [],
  );
  const addDiscipleship = useCallback(
    (date: Date) => setComposer({ kind: "discipleship", date }),
    [],
  );
  const laneAddHandlers: Record<DotKind, (date: Date) => void> = useMemo(
    () => ({ logos: addLogos, prayer: addPrayer, discipleship: addDiscipleship }),
    [addLogos, addPrayer, addDiscipleship],
  );

  return (
    <div className="flex h-full flex-col bg-[var(--color-paper)]">
      <Toolbar
        zoom={currentZoom}
        onZoom={setZoom}
        onToday={recenterOnToday}
        displayName={displayName}
        showAllConnectors={showAllConnectors}
        onToggleConnectors={() => setShowAllConnectors((v) => !v)}
      />
      <div
        ref={overlayHostRef}
        className="relative flex flex-1 flex-col overflow-hidden"
      >
        <BibleReader />
        <BooksLane dots={dots} onHoverBook={setHoverBookId} />
        {selectedBookId && (
          <div className="flex items-center justify-between border-b border-[var(--color-rule)] bg-[var(--color-ink)]/90 px-4 py-1.5 text-[11px] text-[var(--color-paper)]">
            <span className="uppercase tracking-widest">
              Filtered to <span className="font-semibold">{selectedBookId}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedBookId(null)}
              className="rounded-full px-2 py-0.5 text-xs hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        )}
        <div
          ref={panRef}
          className="paper relative flex-1 cursor-grab overflow-hidden select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <TimeRuler viewportWidth={viewportWidth} />
          {(["logos", "prayer", "discipleship"] as DotKind[]).map((kind) => (
            <Lane
              key={kind}
              kind={kind}
              title={LANE_TITLE[kind]}
              accent={ACCENT[kind]}
              viewportWidth={viewportWidth}
              dots={filteredDots}
              onAdd={laneAddHandlers[kind]}
              onOpenDot={handleOpenDot}
              onHoverDot={setHoverDotId}
            />
          ))}
        </div>

        {/* Connector lines from dots up to the books they reference. Sits
            over BooksLane + lanes so the SVG can span both regions. */}
        <ConnectorOverlay
          containerRef={overlayHostRef}
          dots={filteredDots}
          hoverDotId={hoverDotId}
          hoverBookId={hoverBookId}
          selectedBookId={selectedBookId}
          showAll={showAllConnectors}
        />
      </div>

      <DotSheet
        dot={activeDot}
        onClose={handleCloseSheet}
        onUpdate={onUpdateDot}
        onDelete={handleDeleteDot}
      />
      {composer && (
        <NewDotComposer
          open
          kind={composer.kind}
          date={composer.date}
          onClose={() => setComposer(null)}
          onSubmit={(d) => onCreateDot(d)}
        />
      )}
    </div>
  );
}

function Toolbar({
  zoom,
  onZoom,
  onToday,
  displayName,
  showAllConnectors,
  onToggleConnectors,
}: {
  zoom: ZoomLevel;
  onZoom(z: ZoomLevel): void;
  onToday(): void;
  displayName?: string | null;
  showAllConnectors: boolean;
  onToggleConnectors(): void;
}) {
  const levels: ZoomLevel[] = ["day", "week", "month", "quarter", "year"];
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="font-serif text-lg font-semibold tracking-tight text-[var(--color-ink)]">
          Bibliteracy
        </div>
        <span className="hidden text-xs text-[var(--color-ink-2)] sm:inline">
          Drag to pan · Cmd/Ctrl + scroll to zoom · T for today
        </span>
      </div>

      <div className="flex items-center gap-1">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onZoom(l)}
            className={
              "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest " +
              (zoom === l
                ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "text-[var(--color-ink-2)] hover:bg-black/5")
            }
          >
            {l}
          </button>
        ))}
        <button
          type="button"
          onClick={onToday}
          className="ml-2 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink)] hover:bg-white"
          title="Recenter on today (T)"
        >
          Today
        </button>

        <button
          type="button"
          onClick={onToggleConnectors}
          aria-pressed={showAllConnectors}
          title={
            showAllConnectors
              ? "Hide all dot ↔ book connectors"
              : "Show all dot ↔ book connectors"
          }
          className={
            "ml-1 rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-widest " +
            (showAllConnectors
              ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
              : "border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-white")
          }
        >
          {showAllConnectors ? "Lines: all" : "Lines"}
        </button>

        <Link
          href="/atlas"
          className="ml-1 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink)] hover:bg-white"
          title="Open the cross-reference atlas"
        >
          Atlas
        </Link>

        <div className="mx-2 h-5 w-px bg-[var(--color-rule)]" />

        <Link
          href="/lounge"
          className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-2)] hover:bg-black/5"
        >
          Lounge
        </Link>
        <Link
          href="/settings"
          className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-2)] hover:bg-black/5"
        >
          Guests
        </Link>

        {displayName && (
          <span
            className="ml-2 max-w-[14ch] truncate rounded-md bg-black/5 px-2 py-1 text-[11px] font-medium text-[var(--color-ink-2)]"
            title={displayName}
          >
            {displayName}
          </span>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-2)] hover:bg-black/5"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

// Zoom levels reference (kept here so the hint text stays in sync).
export const ZOOM_LEVELS: ZoomLevel[] = ["day", "week", "month", "quarter", "year"];
export const ZOOM_PX = ZOOM_PX_PER_DAY;
