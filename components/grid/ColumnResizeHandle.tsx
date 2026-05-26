"use client";

import { useCallback, type PointerEvent as ReactPointerEvent } from "react";

const HANDLE_PX = 6;

export type ColumnResizeHandleProps = {
  label: string;
  onResize: (deltaX: number) => void;
};

/** Vertical drag strip between two side-by-side panels. */
export function ColumnResizeHandle({ label, onResize }: ColumnResizeHandleProps) {
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      let lastX = e.clientX;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        if (dx !== 0) onResize(dx);
      };
      const onUp = () => {
        target.releasePointerCapture(e.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onResize],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      className="relative z-[2] shrink-0 cursor-ew-resize touch-none select-none border-x border-[var(--color-rule)] bg-[var(--color-paper-2)]/40"
      style={{ width: HANDLE_PX }}
    >
      <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[var(--color-rule)] transition-colors hover:bg-[var(--color-ink-2)]/60" />
    </div>
  );
}
