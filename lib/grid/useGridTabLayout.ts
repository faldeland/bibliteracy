"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_GRID_TAB_LAYOUT,
  applyTabDrop,
  readGridTabLayoutFromStorage,
  writeGridTabLayoutToStorage,
  type GridPane,
  type GridTabId,
  type GridTabLayout,
} from "@/lib/grid/gridTabLayout";

export type GridTabDragState = {
  draggingId: GridTabId;
  dropPane: GridPane | null;
  dropIndex: number | null;
} | null;

function firstTab(layout: GridTabLayout, pane: GridPane): GridTabId | null {
  const list = pane === "left" ? layout.left : layout.right;
  return list[0] ?? null;
}

export function useGridTabLayout() {
  const [layout, setLayout] = useState<GridTabLayout>(DEFAULT_GRID_TAB_LAYOUT);
  const [activeLeftTab, setActiveLeftTab] = useState<GridTabId>("journal");
  const [activeRightTab, setActiveRightTab] = useState<GridTabId>("commentary");
  const [dragState, setDragState] = useState<GridTabDragState>(null);

  useEffect(() => {
    const stored = readGridTabLayoutFromStorage();
    if (!stored) return;
    setLayout(stored);
    if (stored.left[0]) setActiveLeftTab(stored.left[0]);
    if (stored.right[0]) setActiveRightTab(stored.right[0]);
  }, []);

  const persistLayout = useCallback((next: GridTabLayout) => {
    setLayout(next);
    writeGridTabLayoutToStorage(next);
  }, []);

  const ensureActiveAfterLayout = useCallback((next: GridTabLayout) => {
    setActiveLeftTab((cur) => {
      if (next.left.includes(cur)) return cur;
      return firstTab(next, "left") ?? cur;
    });
    setActiveRightTab((cur) => {
      if (next.right.includes(cur)) return cur;
      return firstTab(next, "right") ?? cur;
    });
  }, []);

  const handleDragStart = useCallback((id: GridTabId) => {
    setDragState({ draggingId: id, dropPane: null, dropIndex: null });
  }, []);

  const setDropTarget = useCallback((pane: GridPane, dropIndex: number) => {
    setDragState((prev) => {
      if (!prev) return prev;
      if (prev.dropPane === pane && prev.dropIndex === dropIndex) return prev;
      return { ...prev, dropPane: pane, dropIndex };
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  const handleDrop = useCallback(() => {
    if (!dragState?.dropPane || dragState.dropIndex == null) {
      setDragState(null);
      return;
    }
    const { draggingId, dropPane, dropIndex } = dragState;
    setDragState(null);
    const next = applyTabDrop(layout, draggingId, dropPane, dropIndex);
    persistLayout(next);
    ensureActiveAfterLayout(next);
  }, [dragState, layout, persistLayout, ensureActiveAfterLayout]);

  const journalActive =
    (layout.left.includes("journal") &&
      activeLeftTab === "journal") ||
    (layout.right.includes("journal") && activeRightTab === "journal");

  return {
    layout,
    activeLeftTab,
    activeRightTab,
    setActiveLeftTab,
    setActiveRightTab,
    journalActive,
    tabDragState: dragState,
    handleTabDragStart: handleDragStart,
    setTabDropTarget: setDropTarget,
    handleTabDragEnd: handleDragEnd,
    handleTabDrop: handleDrop,
  };
}
