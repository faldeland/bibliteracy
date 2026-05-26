"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { GridPane, GridTabId } from "@/lib/grid/gridTabLayout";
import { useGridTabDrag } from "./GridTabDragContext";

const GRID_TAB_DRAG_MIME = "application/x-grid-tab-id";

type GridTabsContextValue = {
  activeId: string;
  setActiveId: (id: string) => void;
  baseId: string;
};

const GridTabsContext = createContext<GridTabsContextValue | null>(null);

function useGridTabs() {
  const ctx = useContext(GridTabsContext);
  if (!ctx) {
    throw new Error("GridTab components must be used within <GridTabs>");
  }
  return ctx;
}

interface GridTabsProps {
  activeId: string;
  onActiveIdChange: (id: string) => void;
  children: ReactNode;
}

/** Tab chrome for the grid canvas area below the books strip. */
export function GridTabs({ activeId, onActiveIdChange, children }: GridTabsProps) {
  const baseId = useId();
  const value = useMemo(
    () => ({ activeId, setActiveId: onActiveIdChange, baseId }),
    [activeId, onActiveIdChange, baseId],
  );
  return (
    <GridTabsContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </GridTabsContext.Provider>
  );
}

export function GridTabList({
  pane,
  tabCount,
  children,
  ariaLabel = "Grid sections",
}: {
  pane: GridPane;
  /** Number of tabs in this pane (for trailing drop target). */
  tabCount: number;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const { dragState, setDropTarget, onDrop } = useGridTabDrag();

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(GRID_TAB_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (tabCount === 0) setDropTarget(pane, 0);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(GRID_TAB_DRAG_MIME)) return;
    e.preventDefault();
    onDrop();
  };

  const showEndDrop =
    dragState?.dropPane === pane && dragState.dropIndex === tabCount;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex min-h-[34px] shrink-0 border-b border-[var(--color-rule)] bg-[var(--color-paper)]"
    >
      {tabCount === 0 && (
        <TabPaneEmptyDrop pane={pane} isActive={dragState?.dropPane === pane} />
      )}
      {children}
      {tabCount > 0 && (
        <div
          className={cn(
            "relative min-w-6 flex-1",
            showEndDrop && "bg-[var(--color-ink)]/5",
          )}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(GRID_TAB_DRAG_MIME)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDropTarget(pane, tabCount);
          }}
          onDrop={handleDrop}
        >
          {showEndDrop && (
            <span
              className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--color-ink)]"
              aria-hidden
            />
          )}
        </div>
      )}
    </div>
  );
}

function TabPaneEmptyDrop({
  pane,
  isActive,
}: {
  pane: GridPane;
  isActive: boolean;
}) {
  const { setDropTarget } = useGridTabDrag();
  return (
    <div
      className={cn(
        "flex flex-1 items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]",
        isActive && "bg-[var(--color-ink)]/5 text-[var(--color-ink)]",
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(GRID_TAB_DRAG_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDropTarget(pane, 0);
      }}
    >
      Drop tab here
    </div>
  );
}

export function GridTab({
  pane,
  tabIndex,
  id,
  label,
}: {
  pane: GridPane;
  tabIndex: number;
  id: GridTabId;
  label: string;
}) {
  const { activeId, setActiveId, baseId } = useGridTabs();
  const { dragState, onDragStart, onDragEnd, onDrop, setDropTarget } =
    useGridTabDrag();
  const selected = activeId === id;
  const isDragging = dragState?.draggingId === id;
  const showDropBefore =
    dragState?.dropPane === pane && dragState.dropIndex === tabIndex;

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(GRID_TAB_DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const dropIndex = e.clientX < midX ? tabIndex : tabIndex + 1;
    setDropTarget(pane, dropIndex);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(GRID_TAB_DRAG_MIME, id);
    onDragStart(id);
  };

  return (
    <div className="relative flex shrink-0">
      {showDropBefore && (
        <span
          className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-0.5 bg-[var(--color-ink)]"
          aria-hidden
        />
      )}
      <button
        type="button"
        role="tab"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes(GRID_TAB_DRAG_MIME)) return;
          e.preventDefault();
          onDrop();
        }}
        id={`${baseId}-tab-${id}`}
        aria-selected={selected}
        aria-controls={`${baseId}-panel-${id}`}
        tabIndex={selected ? 0 : -1}
        onClick={() => setActiveId(id)}
        title="Drag to reorder or move to the other panel"
        className={cn(
          "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors",
          "cursor-grab active:cursor-grabbing",
          selected
            ? "border-[var(--color-ink)] text-[var(--color-ink)]"
            : "border-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)]",
          isDragging && "opacity-40",
        )}
      >
        <span
          className="select-none text-[var(--color-ink-2)]/50"
          aria-hidden
        >
          ⋮⋮
        </span>
        {label}
      </button>
    </div>
  );
}

export function GridTabPanel({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { activeId, baseId } = useGridTabs();
  if (activeId !== id) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${id}`}
      aria-labelledby={`${baseId}-tab-${id}`}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      {children}
    </div>
  );
}
