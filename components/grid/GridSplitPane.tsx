"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useGridSplitRatio } from "@/lib/grid/useGridSplitRatio";
import { ColumnResizeHandle } from "./ColumnResizeHandle";

interface GridSplitPaneProps {
  left: ReactNode;
  right: ReactNode;
}

/** Two-column layout below the books strip; width ratio persisted in a cookie. */
export function GridSplitPane({ left, right }: GridSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { leftPct, resizeByContainerWidth } = useGridSplitRatio();

  const onResize = useCallback(
    (deltaX: number) => {
      const w = containerRef.current?.clientWidth ?? 0;
      resizeByContainerWidth(deltaX, w);
    },
    [resizeByContainerWidth],
  );

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 flex-row overflow-hidden"
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ width: `${leftPct}%` }}
      >
        {left}
      </div>
      <ColumnResizeHandle
        label="Resize journal and commentary panels"
        onResize={onResize}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {right}
      </div>
    </div>
  );
}
