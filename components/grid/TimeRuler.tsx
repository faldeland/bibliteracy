"use client";

import { useMemo } from "react";
import { useGridStore } from "@/lib/grid/state";
import {
  addDays,
  diffDays,
  formatTickLabel,
  isMajorTick,
  isSameDay,
  zoomLevelFor,
} from "@/lib/grid/time";
import { useNow } from "@/lib/grid/useNow";

interface TimeRulerProps {
  viewportWidth: number;
}

export function TimeRuler({ viewportWidth }: TimeRulerProps) {
  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const centerDate = useGridStore((s) => s.centerDate);
  const now = useNow();
  const zoom = zoomLevelFor(pxPerDay);

  const ticks = useMemo(() => {
    if (viewportWidth <= 0) return [];
    const halfPx = viewportWidth / 2;
    const halfDays = Math.ceil(halfPx / pxPerDay) + 2;
    const firstDay = addDays(centerDate, -halfDays);
    const totalDays = halfDays * 2 + 1;
    const out: { date: Date; left: number; major: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(firstDay, i);
      const left = diffDays(d, centerDate) * pxPerDay + halfPx;
      out.push({ date: d, left, major: isMajorTick(d, zoom) });
    }
    return out;
  }, [viewportWidth, pxPerDay, centerDate, zoom]);

  if (viewportWidth <= 0) return null;

  const halfPx = viewportWidth / 2;
  const todayLeft = diffDays(now, centerDate) * pxPerDay + halfPx;

  return (
    <div className="relative h-8 w-full select-none border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]/40">
      {ticks.map(({ date, left, major }) =>
        major ? (
          <div
            key={date.toISOString()}
            className="absolute top-0 flex h-full flex-col items-start"
            style={{ left }}
          >
            <div className="-translate-x-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-2)]">
              {formatTickLabel(date, zoom)}
            </div>
            <div className="mt-auto h-3 w-px bg-[var(--color-ink-2)]/60" />
          </div>
        ) : (
          <div
            key={date.toISOString()}
            className="absolute bottom-0 h-1.5 w-px bg-[var(--color-ink-2)]/20"
            style={{ left }}
          />
        ),
      )}

      {/* Today marker */}
      {todayLeft >= -1 && todayLeft <= viewportWidth + 1 && (
        <div
          className="pointer-events-none absolute top-0 h-full"
          style={{ left: todayLeft }}
        >
          <div className="h-full w-0.5 bg-[var(--color-today)]" />
        </div>
      )}

      {/* Center marker — now anchored to the top edge so it points up into
          the lanes, since the ruler has moved to the bottom of the canvas. */}
      {ticks.some(({ date }) => isSameDay(date, centerDate)) && (
        <div
          className="pointer-events-none absolute top-0 h-1 w-px bg-[var(--color-ink)]/40"
          style={{ left: halfPx }}
        />
      )}
    </div>
  );
}
