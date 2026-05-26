"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loungeBarHeightPx } from "@/lib/lounge/loungeBarLayout";
import {
  LOUNGE_TILE_HEIGHT_DEFAULT_PX,
  LOUNGE_TILE_HEIGHT_KEY,
  clampLoungeTileHeight,
  readStoredLoungeTileHeight,
} from "@/lib/lounge/loungeBarHeight";

export function useLoungeBarHeight() {
  const [tileHeight, setTileHeight] = useState(LOUNGE_TILE_HEIGHT_DEFAULT_PX);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = readStoredLoungeTileHeight();
    if (stored != null) setTileHeight(stored);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(LOUNGE_TILE_HEIGHT_KEY, String(tileHeight));
  }, [tileHeight]);

  const resizeBar = useCallback((deltaY: number) => {
    setTileHeight((h) => clampLoungeTileHeight(h + deltaY));
  }, []);

  return {
    tileHeight,
    barHeight: loungeBarHeightPx(tileHeight),
    resizeBar,
  };
}
