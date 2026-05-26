"use client";

import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { LOUNGE_RESIZE_HANDLE_PX } from "@/lib/lounge/loungeBarLayout";

export type LoungeBarResizeHandleProps = {
  onResize: (deltaY: number) => void;
};

/** Horizontal drag strip at the bottom of the lounge stream bar. */
export function LoungeBarResizeHandle({ onResize }: LoungeBarResizeHandleProps) {
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
      aria-label="Resize lounge videos"
      title="Drag to resize videos"
      onPointerDown={onPointerDown}
      className="relative z-[2] shrink-0 cursor-ns-resize touch-none select-none border-t border-white/10 bg-[var(--color-ink)]"
      style={{ height: LOUNGE_RESIZE_HANDLE_PX }}
    >
      <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-white/20 transition-colors hover:bg-white/40" />
    </div>
  );
}
