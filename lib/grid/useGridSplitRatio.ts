"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GRID_SPLIT_DEFAULT_PCT,
  clampGridSplitPct,
  readGridSplitPctFromCookie,
  writeGridSplitCookie,
} from "@/lib/grid/gridSplitCookie";

export function useGridSplitRatio() {
  const [leftPct, setLeftPct] = useState(GRID_SPLIT_DEFAULT_PCT);

  useEffect(() => {
    const stored = readGridSplitPctFromCookie();
    if (stored != null) setLeftPct(stored);
  }, []);

  const resizeByContainerWidth = useCallback(
    (deltaX: number, containerWidth: number) => {
      if (containerWidth <= 0) return;
      setLeftPct((pct) => {
        const next = clampGridSplitPct(pct + (deltaX / containerWidth) * 100);
        writeGridSplitCookie(next);
        return next;
      });
    },
    [],
  );

  return { leftPct, resizeByContainerWidth };
}
