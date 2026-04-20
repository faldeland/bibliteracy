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
import { TimelineSettingsSheet } from "./TimelineSettingsSheet";
import {
  BibleHeaderSlot,
  BibleHeaderSlotProvider,
} from "./bibleHeaderSlot";
import { useGridStore } from "@/lib/grid/state";
import { zoomLevelFor, ZOOM_PX_PER_DAY, type ZoomLevel } from "@/lib/grid/time";
import type { Dot, DotKind } from "@/lib/grid/types";
import type { DotUpdate, NewDotInput } from "@/lib/grid/dotsApi";
import { useTimelines, type Timeline } from "@/lib/grid/timelinesApi";

const BUILTIN_ACCENT: Record<DotKind, string> = {
  logos: "var(--color-logos)",
  prayer: "var(--color-prayer)",
  discipleship: "var(--color-discipleship)",
};

// Palette for custom (user-created) timelines. Chosen to harmonize with the
// built-in amber / indigo / evergreen trio on the paper background and stay
// distinguishable from each other across typical display gamuts.
const CUSTOM_PALETTE = [
  "#7a4a8c", // plum
  "#a0451f", // rust
  "#4e7a9c", // slate
  "#6e7a2a", // olive
  "#9c4563", // rose
  "#2f6d7d", // teal
];

function accentForTimeline(timeline: Timeline, customIndex: number): string {
  // Explicit per-timeline color wins over the built-in / palette defaults.
  if (timeline.color) return timeline.color;
  if (timeline.builtinKind) return BUILTIN_ACCENT[timeline.builtinKind];
  return CUSTOM_PALETTE[customIndex % CUSTOM_PALETTE.length];
}

interface GridCanvasProps {
  userId: string;
  dots: Dot[];
  /** Display label for the current user (name or email). */
  displayName?: string | null;
  onCreateDot(d: NewDotInput): void;
  onUpdateDot?(id: string, patch: DotUpdate): void;
  onDeleteDot?(id: string): void;
}

export function GridCanvas({
  userId,
  dots,
  displayName,
  onCreateDot,
  onUpdateDot,
  onDeleteDot,
}: GridCanvasProps) {
  const panRef = useRef<HTMLDivElement | null>(null);
  const lanesScrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const panByPx = useGridStore((s) => s.panByPx);
  const zoomAt = useGridStore((s) => s.zoomAt);
  const recenterOnToday = useGridStore((s) => s.recenterOnToday);
  const setZoom = useGridStore((s) => s.setZoom);

  const {
    timelines,
    createTimeline,
    updateTimeline,
    deleteTimeline,
    moveTimeline,
  } = useTimelines(userId);

  // Precompute per-timeline accents. We use the position of each custom
  // timeline among other custom timelines to pick from the palette — this
  // stays stable across reorders as long as the relative custom ordering
  // doesn't change.
  const accents = useMemo(() => {
    const out = new Map<string, string>();
    let customCount = 0;
    for (const t of timelines) {
      out.set(t.id, accentForTimeline(t, customCount));
      if (!t.builtinKind) customCount += 1;
    }
    return out;
  }, [timelines]);

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

  // Pan via pointer drag. Day cells, dots, and the "+ Add" pill are all
  // `<button>`s that cover most of the lane, so we can't bail out of the
  // drag on every button press — the user would have nowhere to grab.
  // Instead, we start tracking on pointerdown and only commit to panning
  // (capture the pointer, swallow the underlying click) once movement
  // crosses a small threshold. A quick press-and-release still falls
  // through to the button's click handler.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    accum: number;
    captured: boolean;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Genuinely text-entry / navigation / native-drag targets keep the
    // pointer — they have their own gesture semantics and panning over
    // them would feel wrong (e.g. text selection, link activation, the
    // lane-reorder drag handle).
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'input, textarea, select, a, [contenteditable="true"], [draggable="true"]',
      )
    ) {
      return;
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      accum: 0,
      captured: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (!drag.captured) {
        // Wait until the user has clearly moved before stealing the
        // click from the underlying button. 4px matches the platform
        // drag-threshold feel on most OSes.
        if (Math.abs(e.clientX - drag.startX) < 4) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.captured = true;
      }
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      drag.accum -= dx; // dragging right = pan into the past
      const pxPerDayNow = useGridStore.getState().pxPerDay;
      if (Math.abs(drag.accum) >= pxPerDayNow) {
        const days = Math.trunc(drag.accum / pxPerDayNow);
        panByPx(days * pxPerDayNow);
        drag.accum -= days * pxPerDayNow;
      }
    },
    [panByPx],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.captured) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  // Wheel:
  //   Cmd/Ctrl+wheel  → zoom at cursor
  //   Shift+wheel     → pan horizontally (deltaY used as dx)
  //   deltaX dominant → pan horizontally (trackpad horizontal swipe)
  //   otherwise       → let the native scroll handle it so the lanes stack
  //                     can scroll vertically when it overflows.
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
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        panByPx(e.deltaY || e.deltaX);
        return;
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        panByPx(e.deltaX);
        return;
      }
      // Fall through: native scroll takes over (vertical wheel scrolls the
      // lanes stack when it overflows).
    },
    [zoomAt, panByPx],
  );

  // Non-passive wheel listener so the React `onWheel` above can preventDefault
  // for the cases it chooses to consume. We have to mirror the gesture
  // detection here because browsers decide whether preventDefault is allowed
  // from the native listener's passive flag, not from the React one.
  useEffect(() => {
    const el = panRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        return;
      }
      if (ev.shiftKey) {
        ev.preventDefault();
        return;
      }
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
        ev.preventDefault();
      }
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
  // Sibling dots sharing the same lane + day as the active dot, newest first.
  // When there are multiple dots on a day the side panel exposes prev/next
  // navigation across them; opening the cluster lands on the latest (index 0).
  const activeSiblings = useMemo(() => {
    if (!activeDot) return [] as Dot[];
    return dots
      .filter((d) => {
        if (d.occurredOn !== activeDot.occurredOn) return false;
        // Same lane = same timeline_id when both are set; otherwise fall back
        // to kind (for legacy null-timeline dots).
        if (activeDot.timelineId || d.timelineId) {
          return d.timelineId === activeDot.timelineId;
        }
        return d.kind === activeDot.kind;
      })
      .sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      );
  }, [activeDot, dots]);

  const [composer, setComposer] = useState<{
    timeline: Timeline;
    date: Date;
  } | null>(null);
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

  const openComposerForTimeline = useCallback(
    (timeline: Timeline, date: Date) => {
      setComposer({ timeline, date });
    },
    [],
  );

  // ─── Timeline drag-reorder state ───────────────────────────────────────
  const [dragState, setDragState] = useState<{
    draggingId: string;
    dropIndex: number | null;
  } | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDragState({ draggingId: id, dropIndex: null });
  }, []);

  const setDropIndex = useCallback((dropIndex: number) => {
    setDragState((prev) => {
      if (!prev) return prev;
      if (prev.dropIndex === dropIndex) return prev;
      return { ...prev, dropIndex };
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  const handleDrop = useCallback(async () => {
    if (!dragState) return;
    const { draggingId, dropIndex } = dragState;
    setDragState(null);
    if (dropIndex == null) return;
    await moveTimeline(draggingId, dropIndex);
  }, [dragState, moveTimeline]);

  const handleRenameTimeline = useCallback(
    (id: string, name: string) => {
      void updateTimeline(id, { name });
    },
    [updateTimeline],
  );

  const handleDeleteTimeline = useCallback(
    (timeline: Timeline) => {
      // Count how many dots live on this timeline — confirm with the user if
      // the delete would take real data with it (cascades via FK).
      const affected = dots.filter((d) => d.timelineId === timeline.id).length;
      const ok = window.confirm(
        affected > 0
          ? `Delete the "${timeline.name}" timeline and its ${affected} dot${affected === 1 ? "" : "s"}? This can't be undone.`
          : `Delete the "${timeline.name}" timeline?`,
      );
      if (!ok) return;
      void deleteTimeline(timeline.id);
    },
    [deleteTimeline, dots],
  );

  const handleNewTimeline = useCallback(async () => {
    const name = window.prompt("Name for the new timeline?")?.trim();
    if (!name) return;
    await createTimeline({ name });
  }, [createTimeline]);

  // ─── Timeline settings sheet ───────────────────────────────────────────
  const [settingsTimelineId, setSettingsTimelineId] = useState<string | null>(
    null,
  );
  const settingsTimeline = useMemo(
    () =>
      settingsTimelineId
        ? timelines.find((t) => t.id === settingsTimelineId) ?? null
        : null,
    [settingsTimelineId, timelines],
  );
  const handleOpenSettings = useCallback((t: Timeline) => {
    setSettingsTimelineId(t.id);
  }, []);
  const handleCloseSettings = useCallback(() => {
    setSettingsTimelineId(null);
  }, []);
  const handleUpdateTimeline = useCallback(
    (id: string, patch: Parameters<typeof updateTimeline>[1]) => {
      void updateTimeline(id, patch);
    },
    [updateTimeline],
  );
  const handleDeleteFromSheet = useCallback(
    (t: Timeline) => {
      // Reuse the confirm + delete flow, closing the sheet on success.
      handleDeleteTimeline(t);
      setSettingsTimelineId(null);
    },
    [handleDeleteTimeline],
  );

  return (
    <BibleHeaderSlotProvider>
    <div className="flex h-full flex-col bg-[var(--color-paper)]">
      <TopNav displayName={displayName} />
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
          className="paper relative flex flex-1 cursor-grab flex-col overflow-hidden select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <TimeRuler viewportWidth={viewportWidth} />
          {/* Scrollable lanes stack. Horizontal panning is handled by
              re-centering via pxPerDay/centerDate (not native scroll), so
              we only expose vertical scrolling here — the stack grows
              when the user adds timelines and we want them reachable
              without squeezing existing lanes. */}
          <div
            ref={lanesScrollRef}
            className="relative flex-1 overflow-x-hidden overflow-y-auto"
          >
            {timelines.map((t, idx) => (
              <Lane
                key={t.id}
                timeline={t}
                accent={accents.get(t.id) ?? "var(--color-ink)"}
                viewportWidth={viewportWidth}
                dots={filteredDots}
                onAdd={(date) => openComposerForTimeline(t, date)}
                onOpenDot={handleOpenDot}
                onHoverDot={setHoverDotId}
              onRename={handleRenameTimeline}
              onDelete={handleDeleteTimeline}
              onOpenSettings={handleOpenSettings}
              isDragging={dragState?.draggingId === t.id}
                isDropTarget={dragState?.dropIndex === idx}
                laneIndex={idx}
                onDragStart={handleDragStart}
                onDragOverLane={setDropIndex}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            ))}
            {/* Trailing drop zone lets the user land a drag at the very
                bottom (position = timelines.length) without having to
                hover the lower half of the last lane — that's a fiddly
                gesture. */}
            {timelines.length > 0 && (
              <TrailingDropZone
                index={timelines.length}
                isActive={dragState?.dropIndex === timelines.length}
                onDragOverLane={setDropIndex}
                onDrop={handleDrop}
              />
            )}
          </div>
        </div>

        {/* Connector lines from dots up to the books they reference. Sits
            over BooksLane + lanes so the SVG can span both regions. */}
        <ConnectorOverlay
          containerRef={overlayHostRef}
          scrollContainerRef={lanesScrollRef}
          dots={filteredDots}
          hoverDotId={hoverDotId}
          hoverBookId={hoverBookId}
          selectedBookId={selectedBookId}
          showAll={showAllConnectors}
        />
      </div>

      <TimelineControls
        zoom={currentZoom}
        onZoom={setZoom}
        onToday={recenterOnToday}
        showAllConnectors={showAllConnectors}
        onToggleConnectors={() => setShowAllConnectors((v) => !v)}
        onNewTimeline={handleNewTimeline}
      />

      <DotSheet
        dot={activeDot}
        siblings={activeSiblings}
        onSelectSibling={setActiveDotId}
        onClose={handleCloseSheet}
        onUpdate={onUpdateDot}
        onDelete={handleDeleteDot}
      />
      {composer && (
        <NewDotComposer
          open
          timeline={composer.timeline}
          date={composer.date}
          onClose={() => setComposer(null)}
          onSubmit={(d) => onCreateDot(d)}
        />
      )}

      <TimelineSettingsSheet
        timeline={settingsTimeline}
        effectiveAccent={
          settingsTimeline
            ? accents.get(settingsTimeline.id) ?? "var(--color-ink)"
            : "var(--color-ink)"
        }
        onClose={handleCloseSettings}
        onUpdate={handleUpdateTimeline}
        onDelete={handleDeleteFromSheet}
      />
    </div>
    </BibleHeaderSlotProvider>
  );
}

// Invisible row at the bottom of the stack that captures "drop at the very
// end" without forcing the user to hover the lower half of the last lane.
function TrailingDropZone({
  index,
  isActive,
  onDragOverLane,
  onDrop,
}: {
  index: number;
  isActive: boolean;
  onDragOverLane: (dropIndex: number) => void;
  onDrop: () => void;
}) {
  return (
    <div
      className="relative h-3 w-full"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("application/x-timeline-id")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverLane(index);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("application/x-timeline-id")) return;
        e.preventDefault();
        onDrop();
      }}
    >
      {isActive && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          style={{ background: "var(--color-ink)" }}
        />
      )}
    </div>
  );
}

// Top-level app navigation: brand, cross-app links, account. Deliberately
// does not include any timeline-canvas controls — those live in
// <TimelineControls /> so they can sit directly above the lanes they
// operate on.
function TopNav({ displayName }: { displayName?: string | null }) {
  return (
    <header className="flex items-center gap-3 border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-1">
      <div className="flex shrink-0 items-center gap-3">
        <div className="font-serif text-lg font-semibold tracking-tight text-[var(--color-ink)]">
          Bibliteracy
        </div>
      </div>

      {/* BibleReader portals its verse search + version-picker controls
          into this slot so they live in the global header, not squashed
          into the reader section below. */}
      <BibleHeaderSlot className="flex min-w-0 flex-1 items-center gap-2" />

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/atlas"
          className="rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink)] hover:bg-white"
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

// Controls that operate on the timeline canvas: zoom granularity, recenter,
// connector visibility, timeline creation. Rendered as the page footer so
// vertical space above is maximized for the lanes stack (which can now
// scroll when more timelines exist than fit on screen).
function TimelineControls({
  zoom,
  onZoom,
  onToday,
  showAllConnectors,
  onToggleConnectors,
  onNewTimeline,
}: {
  zoom: ZoomLevel;
  onZoom(z: ZoomLevel): void;
  onToday(): void;
  showAllConnectors: boolean;
  onToggleConnectors(): void;
  onNewTimeline(): void;
}) {
  const levels: ZoomLevel[] = ["day", "week", "month", "quarter", "year"];
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-1">
      <span className="hidden text-[10px] text-[var(--color-ink-2)] sm:inline">
        Drag to pan · Shift/horizontal scroll to pan · Cmd/Ctrl + scroll to zoom · T for today
      </span>
      <div className="flex items-center gap-1">
      {levels.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onZoom(l)}
          className={
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest " +
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
        className="ml-2 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink)] hover:bg-white"
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
          "ml-1 rounded-md border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest " +
          (showAllConnectors
            ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
            : "border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-white")
        }
      >
        {showAllConnectors ? "Lines: all" : "Lines"}
      </button>

      <button
        type="button"
        onClick={onNewTimeline}
        className="ml-1 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink)] hover:bg-white"
        title="Add a new timeline"
      >
        + Timeline
      </button>
      </div>
    </footer>
  );
}

// Zoom levels reference (kept here so the hint text stays in sync).
export const ZOOM_LEVELS: ZoomLevel[] = ["day", "week", "month", "quarter", "year"];
export const ZOOM_PX = ZOOM_PX_PER_DAY;
