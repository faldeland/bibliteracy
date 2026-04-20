"use client";

import { memo, useCallback, useMemo } from "react";
import { useGridStore } from "@/lib/grid/state";
import { addDays, diffDays, isSameDay, toISO } from "@/lib/grid/time";
import { useNow } from "@/lib/grid/useNow";
import { cn } from "@/lib/utils";
import type { Dot, DotKind } from "@/lib/grid/types";

interface LaneProps {
  kind: DotKind;
  title: string;
  accent: string; // CSS color for dots
  viewportWidth: number;
  dots: Dot[];
  onAdd(date: Date): void;
  onOpenDot(dot: Dot): void;
  onHoverDot?: (dotId: string | null) => void;
}

const LANE_HEIGHT = 84;

export function Lane({
  kind,
  title,
  accent,
  viewportWidth,
  dots,
  onAdd,
  onOpenDot,
  onHoverDot,
}: LaneProps) {
  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const centerDate = useGridStore((s) => s.centerDate);

  const now = useNow();

  // Bucket dots by day for cluster rendering.
  const dotsByDay = useMemo(() => {
    const m = new Map<string, Dot[]>();
    for (const d of dots) {
      if (d.kind !== kind) continue;
      const arr = m.get(d.occurredOn) ?? [];
      arr.push(d);
      m.set(d.occurredOn, arr);
    }
    return m;
  }, [dots, kind]);

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

  if (viewportWidth <= 0) return null;

  const halfPx = viewportWidth / 2;
  const todayLeft = diffDays(now, centerDate) * pxPerDay + halfPx;

  return (
    <div
      className="relative w-full border-b border-[var(--color-rule)]"
      style={{ height: LANE_HEIGHT }}
    >
      {/* Lane label */}
      <div className="pointer-events-none absolute left-3 top-2 z-10 flex items-center gap-2 rounded-full bg-[var(--color-paper)]/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)] shadow-sm">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: accent }}
        />
        {title}
      </div>

      {/* + button: adds a dot anchored to today */}
      <button
        type="button"
        onClick={handleAddToday}
        className="absolute right-3 top-2 z-10 flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 text-[11px] font-semibold text-[var(--color-ink-2)] shadow-sm hover:bg-white"
        title={`Add ${title} dot for today`}
      >
        <span className="text-base leading-none" style={{ color: accent }}>
          +
        </span>
        Add
      </button>

      {/* Today highlight column */}
      {todayLeft >= -1 && todayLeft <= viewportWidth + 1 && (
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5"
          style={{ left: todayLeft, background: "var(--color-today)" }}
        />
      )}

      {/* Day cells (faint background grid) */}
      {pxPerDay >= 18 &&
        days.map(({ date, left, iso }) => {
          const has = dotsByDay.has(iso);
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

      {/* Dots */}
      {days.map(({ left, iso }) => {
        const list = dotsByDay.get(iso);
        if (!list || list.length === 0) return null;
        return (
          <DotCluster
            key={iso}
            list={list}
            left={left + Math.max(pxPerDay / 2, 6)}
            accent={accent}
            onOpenDot={onOpenDot}
            onHoverDot={onHoverDot}
          />
        );
      })}
    </div>
  );
}

interface DotClusterProps {
  list: Dot[];
  left: number;
  accent: string;
  onOpenDot(d: Dot): void;
  onHoverDot?: (dotId: string | null) => void;
}

const DotCluster = memo(function DotCluster({
  list,
  left,
  accent,
  onOpenDot,
  onHoverDot,
}: DotClusterProps) {
  const count = list.length;
  const primary = list[0];
  const handleClick = useCallback(
    () => onOpenDot(primary),
    [onOpenDot, primary],
  );
  const handleEnter = useCallback(
    () => onHoverDot?.(primary.id),
    [onHoverDot, primary.id],
  );
  const handleLeave = useCallback(
    () => onHoverDot?.(null),
    [onHoverDot],
  );
  return (
    <div
      className="absolute -translate-x-1/2"
      style={{ left, top: "50%", transform: `translate(-50%, -50%)` }}
    >
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        data-dot-id={primary.id}
        className="relative flex h-[1.17rem] w-[1.17rem] items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md ring-2 ring-[var(--color-paper)] transition-transform hover:scale-110"
        style={{ background: accent }}
        title={list.map((d) => d.title ?? "(untitled)").join("\n")}
      >
        {count > 1 ? count : ""}
      </button>
    </div>
  );
});
