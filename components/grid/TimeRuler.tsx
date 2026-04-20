"use client";

import { useGridStore } from "@/lib/grid/state";
import {
  addDays,
  diffDays,
  formatTickLabel,
  isMajorTick,
  isSameDay,
  today,
  zoomLevelFor,
} from "@/lib/grid/time";
import { useEffect, useState } from "react";

interface TimeRulerProps {
  viewportWidth: number;
}

export function TimeRuler({ viewportWidth }: TimeRulerProps) {
  const pxPerDay = useGridStore((s) => s.pxPerDay);
  const centerDate = useGridStore((s) => s.centerDate);
  const zoom = zoomLevelFor(pxPerDay);

  // Re-render at midnight so the "today" marker stays current.
  const [now, setNow] = useState(() => today());
  useEffect(() => {
    const tick = () => setNow(today());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (viewportWidth <= 0) return null;

  const halfPx = viewportWidth / 2;
  const halfDays = Math.ceil(halfPx / pxPerDay) + 2;
  const firstDay = addDays(centerDate, -halfDays);
  const totalDays = halfDays * 2 + 1;

  const ticks: { date: Date; left: number; major: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(firstDay, i);
    const left = (diffDays(d, centerDate)) * pxPerDay + halfPx;
    ticks.push({ date: d, left, major: isMajorTick(d, zoom) });
  }

  const todayLeft = diffDays(now, centerDate) * pxPerDay + halfPx;

  return (
    <div className="relative h-8 w-full select-none border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/40">
      {ticks.map(({ date, left, major }) =>
        major ? (
          <div
            key={date.toISOString()}
            className="absolute top-0 h-full"
            style={{ left }}
          >
            <div className="h-3 w-px bg-[var(--color-ink-2)]/60" />
            <div className="mt-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-2)]">
              {formatTickLabel(date, zoom)}
            </div>
          </div>
        ) : (
          <div
            key={date.toISOString()}
            className="absolute top-0 h-1.5 w-px bg-[var(--color-ink-2)]/20"
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

      {/* Center marker */}
      {ticks.some(({ date }) => isSameDay(date, centerDate)) && (
        <div
          className="pointer-events-none absolute bottom-0 h-1 w-px bg-[var(--color-ink)]/40"
          style={{ left: halfPx }}
        />
      )}
    </div>
  );
}
