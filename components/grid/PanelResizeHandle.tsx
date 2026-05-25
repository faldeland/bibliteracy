"use client";

import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { BIBLE_READER_RESIZE_HANDLE_PX } from "@/lib/grid/bibleReaderLayout";

export type PanelResizeHandleProps = {
  label: string;
  onResize: (deltaY: number) => void;
};

/** Horizontal drag strip at the bottom of a resizable panel. */
export function PanelResizeHandle({ label, onResize }: PanelResizeHandleProps) {
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      let lastY = e.clientY;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - lastY;
        lastY = ev.clientY;
        if (dy !== 0) onResize(dy);
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
      aria-orientation="horizontal"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      className="relative z-[2] shrink-0 cursor-ns-resize touch-none select-none"
      style={{ height: BIBLE_READER_RESIZE_HANDLE_PX }}
    >
      <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-[var(--color-rule)] transition-colors hover:bg-[var(--color-ink-2)]/60" />
    </div>
  );
}
