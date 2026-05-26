"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GridTabDragState } from "@/lib/grid/useGridTabLayout";
import type { GridPane, GridTabId } from "@/lib/grid/gridTabLayout";

export type GridTabDragApi = {
  dragState: GridTabDragState;
  onDragStart: (id: GridTabId) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  setDropTarget: (pane: GridPane, dropIndex: number) => void;
};

const GridTabDragContext = createContext<GridTabDragApi | null>(null);

export function GridTabDragProvider({
  value,
  children,
}: {
  value: GridTabDragApi;
  children: ReactNode;
}) {
  return (
    <GridTabDragContext.Provider value={value}>
      {children}
    </GridTabDragContext.Provider>
  );
}

export function useGridTabDrag(): GridTabDragApi {
  const ctx = useContext(GridTabDragContext);
  if (!ctx) {
    throw new Error("Grid tab drag hooks require <GridTabDragProvider>");
  }
  return ctx;
}
