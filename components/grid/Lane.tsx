"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGridStore } from "@/lib/grid/state";
import {
  addDays,
  diffDays,
  formatLocalTime,
  fromISO,
  isSameDay,
  timeOfDayFraction,
  toISO,
} from "@/lib/grid/time";
import { useNow } from "@/lib/grid/useNow";
import { cn } from "@/lib/utils";
import type { Dot } from "@/lib/grid/types";
import type { Timeline } from "@/lib/grid/timelinesApi";
import {
  stepTimelineHeightPreset,
  TIMELINE_HEIGHT_PX,
} from "@/lib/grid/timelinesApi";

interface LaneProps {
  timeline: Timeline;
  accent: string;
  viewportWidth: number;
  dots: Dot[];
  onAdd(date: Date): void;
  onOpenDot(dot: Dot): void;
  onHoverDot?: (dotId: string | null) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (timeline: Timeline) => void;
  onOpenSettings?: (timeline: Timeline) => void;
  onAdjustHeight?: (timeline: Timeline, delta: -1 | 1) => void;
  // Drag-reorder hooks. GridCanvas owns the dragging id and computes drop
  // positions; Lane just wires the DOM events.
  isDragging?: boolean;
  isDropTarget?: boolean;
  /** Index of this lane in the ordered timelines list. */
  laneIndex?: number;
  onDragStart?: (timelineId: string) => void;
  /** Called with the drop-index (0..N) the user is hovering over this lane. */
  onDragOverLane?: (dropIndex: number) => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

// The lane label + "+ Add" pill sit at the top ~14px (halved); keep dots
// below them.
const PLOT_TOP_PAD = 15;
const PLOT_BOTTOM_PAD = 5;

export function Lane({
  timeline,
  accent,
  viewportWidth,
  dots,
  onAdd,
  onOpenDot,
  onHoverDot,
  onRename,
  onDelete,
  onOpenSettings,
  onAdjustHeight,
  isDragging,
  isDropTarget,
  laneIndex,
  onDragStart,
  onDragOverLane,
  onDragEnd,
  onDrop,
}: LaneProps) {
  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const centerDate = useGridStore((s) => s.centerDate);

  const now = useNow();

  const laneHeight = TIMELINE_HEIGHT_PX[timeline.heightPreset];
  const plotH = Math.max(0, laneHeight - PLOT_TOP_PAD - PLOT_BOTTOM_PAD);

  // Filter to this timeline: explicit match by timeline_id, plus a backward-
  // compatible fallback for built-in timelines (dots created before the
  // timelines table existed have timeline_id = null and are matched by kind).
  const laneDots = useMemo(() => {
    return dots
      .filter((d) => {
        if (d.timelineId && d.timelineId === timeline.id) return true;
        if (
          !d.timelineId &&
          timeline.builtinKind &&
          d.kind === timeline.builtinKind
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
      );
  }, [dots, timeline.id, timeline.builtinKind]);

  // Which ISO days have at least one dot — used only to tint the day cell
  // background as a subtle activity indicator. Positioning itself is
  // continuous (date + time-of-day), not bucketed.
  const occupiedIsos = useMemo(() => {
    const s = new Set<string>();
    for (const d of laneDots) s.add(d.occurredOn);
    return s;
  }, [laneDots]);

  const days = useMemo(() => {
    if (viewportWidth <= 0) return [];
    const halfPx = viewportWidth / 2;
    const halfDays = Math.ceil(halfPx / pxPerDay) + 2;
    const firstDay = addDays(centerDate, -halfDays);
    const totalDays = halfDays * 2 + 1;
    const out: { date: Date; left: number; iso: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(firstDay, i);
      const left = diffDays(d, centerDate) * pxPerDay + halfPx;
      out.push({ date: d, left, iso: toISO(d) });
    }
    return out;
  }, [viewportWidth, pxPerDay, centerDate]);

  const handleAddToday = useCallback(() => onAdd(now), [onAdd, now]);

  const halfPx = viewportWidth / 2;

  // Resolve each dot to an (x, y) on the chart: x from (occurredOn + time-of-
  // day), y from time-of-day within the plot band. With a 2D chart we can
  // skip day-clustering entirely; simultaneous dots stack visually but each
  // is still individually clickable.
  const placedDots = useMemo(() => {
    if (viewportWidth <= 0) return [] as {
      dot: Dot;
      left: number;
      top: number;
      timeLabel: string;
    }[];
    const anchor = timeline.verticalAnchor;
    return laneDots.map((dot) => {
      const dayDate = fromISO(dot.occurredOn);
      const frac = timeOfDayFraction(dot.createdAt);
      const dayFromCenter = diffDays(dayDate, centerDate);
      const left = halfPx + (dayFromCenter + frac) * pxPerDay;
      // Vertical position blends the per-lane anchor with the time-of-day
      // offset so anchor=0.5 reproduces the original "dots spread across
      // the lane" behavior, while anchor=0/1 pulls dots to the top/bottom
      // (with time-of-day still providing a small relative offset).
      const normalizedY = clamp01(anchor + (frac - 0.5));
      const top = PLOT_TOP_PAD + normalizedY * plotH;
      return { dot, left, top, timeLabel: formatLocalTime(dot.createdAt) };
    });
  }, [
    laneDots,
    centerDate,
    pxPerDay,
    halfPx,
    viewportWidth,
    plotH,
    timeline.verticalAnchor,
  ]);

  // Horizontal subdivision lines inside the plot region. Rendered only when
  // the lane has enough room that the lines won't fight the dot ring.
  const subdivisionLines = useMemo(() => {
    const n = timeline.gridSubdivisions;
    if (n <= 0 || pxPerDay < 8 || plotH < 6) return [];
    const lines: number[] = [];
    // Evenly spaced strictly between top and bottom of the plot region.
    for (let i = 1; i <= n; i++) {
      lines.push(PLOT_TOP_PAD + (plotH * i) / (n + 1));
    }
    return lines;
  }, [timeline.gridSubdivisions, pxPerDay, plotH]);

  if (viewportWidth <= 0) return null;

  const todayLeft =
    (diffDays(now, centerDate) + timeOfDayFraction(now.toISOString())) *
      pxPerDay +
    halfPx;

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDragOverLane || laneIndex == null) return;
    // Only react to our own drag payload — ignore file drops, etc.
    if (!e.dataTransfer.types.includes("application/x-timeline-id")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dropIndex = e.clientY < midY ? laneIndex : laneIndex + 1;
    onDragOverLane(dropIndex);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onDrop) return;
    if (!e.dataTransfer.types.includes("application/x-timeline-id")) return;
    e.preventDefault();
    onDrop();
  };

  return (
    <div
      className={cn(
        "relative w-full border-b border-[var(--color-rule)] transition-opacity",
        isDragging && "opacity-40",
      )}
      style={{ height: laneHeight }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop indicator: a 2px line at the top of the lane that the user is
          hovering, indicating where the dragged lane will land. */}
      {isDropTarget && (
        <div
          className="pointer-events-none absolute inset-x-0 -top-px z-20 h-0.5"
          style={{ background: "var(--color-ink)" }}
        />
      )}

      {/* Lane header: drag handle + colored dot + editable name + delete */}
      <LaneHeader
        timeline={timeline}
        accent={accent}
        onRename={onRename}
        onDelete={onDelete}
        onOpenSettings={onOpenSettings}
        onAdjustHeight={onAdjustHeight}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />

      {/* + button: adds a dot anchored to today */}
      <button
        type="button"
        onClick={handleAddToday}
        className="absolute right-2 top-0.5 z-10 flex h-5 items-center gap-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-2 text-[10px] font-semibold text-[var(--color-ink-2)] shadow-sm hover:bg-white"
        title={`Add ${timeline.name} dot for today`}
      >
        <span className="text-sm leading-none" style={{ color: accent }}>
          +
        </span>
        Add
      </button>

      {/* Horizontal grid subdivisions inside the plot region. */}
      {subdivisionLines.map((top, i) => (
        <div
          key={i}
          className="pointer-events-none absolute left-0 right-0"
          style={{
            top,
            height: 1,
            background: "var(--color-rule)",
            opacity: 0.35,
          }}
        />
      ))}

      {/* Today highlight column */}
      {timeline.showTodayHighlight &&
        todayLeft >= -1 &&
        todayLeft <= viewportWidth + 1 && (
          <div
            className="pointer-events-none absolute top-0 h-full w-0.5"
            style={{ left: todayLeft, background: "var(--color-today)" }}
          />
        )}

      {/* Day cells (faint background grid + click-to-add) */}
      {timeline.showDayCells &&
        pxPerDay >= 18 &&
        days.map(({ date, left, iso }) => {
          const has = occupiedIsos.has(iso);
          const isToday = isSameDay(date, now);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onAdd(date)}
              title={iso}
              className={cn(
                "absolute top-0 h-full border-r border-[var(--color-rule)]/40 transition-colors",
                "hover:bg-black/5",
                isToday && "bg-[var(--color-today)]/5",
                has && !isToday && "bg-black/[0.02]",
              )}
              style={{ left, width: pxPerDay }}
            />
          );
        })}

      {/* Dots — positioned by date + time-of-day. */}
      {placedDots.map(({ dot, left, top, timeLabel }) => (
        <DotMark
          key={dot.id}
          dot={dot}
          left={left}
          top={top}
          timeLabel={timeLabel}
          accent={accent}
          onOpenDot={onOpenDot}
          onHoverDot={onHoverDot}
        />
      ))}
    </div>
  );
}

// ─── Lane header (drag handle, name, rename, delete) ───────────────────────

function LaneHeader({
  timeline,
  accent,
  onRename,
  onDelete,
  onOpenSettings,
  onAdjustHeight,
  onDragStart,
  onDragEnd,
}: {
  timeline: Timeline;
  accent: string;
  onRename?: (id: string, name: string) => void;
  onDelete?: (timeline: Timeline) => void;
  onOpenSettings?: (timeline: Timeline) => void;
  onAdjustHeight?: (timeline: Timeline, delta: -1 | 1) => void;
  onDragStart?: (timelineId: string) => void;
  onDragEnd?: () => void;
}) {
  const heightPx = TIMELINE_HEIGHT_PX[timeline.heightPreset];
  const canShrink =
    onAdjustHeight &&
    stepTimelineHeightPreset(timeline.heightPreset, -1) !==
      timeline.heightPreset;
  const canGrow =
    onAdjustHeight &&
    stepTimelineHeightPreset(timeline.heightPreset, 1) !== timeline.heightPreset;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(timeline.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(timeline.name);
  }, [timeline.name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (!next) {
      setDraft(timeline.name);
      setEditing(false);
      return;
    }
    if (next !== timeline.name && onRename) onRename(timeline.id, next);
    setEditing(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!onDragStart) return;
    e.dataTransfer.effectAllowed = "move";
    // Custom mime type so we can distinguish lane-drags from e.g. file drops.
    e.dataTransfer.setData("application/x-timeline-id", timeline.id);
    onDragStart(timeline.id);
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className="absolute left-2 top-0.5 z-10 flex items-center gap-1.5 rounded-full bg-[var(--color-paper)]/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)] shadow-sm"
      title="Drag to reorder"
    >
      {/* Drag grip */}
      <span
        className="cursor-grab select-none text-[var(--color-ink-2)]/60 active:cursor-grabbing"
        aria-hidden
      >
        ⋮⋮
      </span>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: accent }}
      />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(timeline.name);
              setEditing(false);
            }
          }}
          maxLength={60}
          className="w-32 rounded border border-[var(--color-rule)] bg-white px-1 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink)] outline-none focus:border-[var(--color-ink-2)]"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => onRename && setEditing(true)}
          className="cursor-text"
          title={onRename ? "Double-click to rename" : undefined}
        >
          {timeline.name}
        </button>
      )}

      {onAdjustHeight && !editing && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onAdjustHeight(timeline, -1)}
            disabled={!canShrink}
            className="ml-0.5 rounded-full px-1 text-[12px] font-bold leading-none text-[var(--color-ink-2)]/60 hover:bg-black/10 hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Decrease ${timeline.name} row height`}
            title={`Decrease row height (${heightPx}px)`}
          >
            −
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onAdjustHeight(timeline, 1)}
            disabled={!canGrow}
            className="rounded-full px-1 text-[12px] font-bold leading-none text-[var(--color-ink-2)]/60 hover:bg-black/10 hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Increase ${timeline.name} row height`}
            title={`Increase row height (${heightPx}px)`}
          >
            +
          </button>
        </>
      )}

      {/* Settings button — opens the configuration sheet. Available on all
          lanes (built-in and custom) since appearance is fully editable. */}
      {onOpenSettings && !editing && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOpenSettings(timeline)}
          className="ml-0.5 rounded-full px-1 text-[14px] leading-none text-[var(--color-ink-2)]/60 hover:bg-black/10 hover:text-[var(--color-ink)]"
          aria-label={`Configure ${timeline.name} timeline`}
          title="Timeline settings"
        >
          ⚙
        </button>
      )}

      {/* Delete button — only for custom timelines. Built-ins are protected
          because deleting them would orphan the kind-specific composer
          features (logos_tag, rooms, etc.). */}
      {!timeline.builtinKind && onDelete && !editing && (
        <button
          type="button"
          onClick={() => onDelete(timeline)}
          className="ml-0.5 rounded-full px-1 text-[var(--color-ink-2)]/60 hover:bg-black/10 hover:text-[var(--color-ink)]"
          aria-label={`Delete ${timeline.name} timeline`}
          title="Delete timeline"
        >
          ×
        </button>
      )}
    </div>
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

interface DotMarkProps {
  dot: Dot;
  left: number;
  top: number;
  timeLabel: string;
  accent: string;
  onOpenDot(d: Dot): void;
  onHoverDot?: (dotId: string | null) => void;
}

const DotMark = memo(function DotMark({
  dot,
  left,
  top,
  timeLabel,
  accent,
  onOpenDot,
  onHoverDot,
}: DotMarkProps) {
  const handleClick = useCallback(() => onOpenDot(dot), [onOpenDot, dot]);
  const handleEnter = useCallback(
    () => onHoverDot?.(dot.id),
    [onHoverDot, dot.id],
  );
  const handleLeave = useCallback(
    () => onHoverDot?.(null),
    [onHoverDot],
  );
  const label = dot.title?.trim() || "(untitled)";
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-dot-id={dot.id}
      className="absolute flex h-[1.17rem] w-[1.17rem] items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md ring-2 ring-[var(--color-paper)] transition-transform hover:scale-110"
      style={{
        left,
        top,
        background: accent,
        transform: "translate(-50%, -50%)",
      }}
      title={`${label}\n${dot.occurredOn} · ${timeLabel}`}
    />
  );
});
