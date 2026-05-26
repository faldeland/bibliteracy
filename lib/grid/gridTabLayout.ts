/** Tab ids for the grid split-pane chrome below the books strip. */
export type GridTabId = "journal" | "commentary" | "strongs";

export type GridPane = "left" | "right";

export type GridTabLayout = {
  left: GridTabId[];
  right: GridTabId[];
};

export const GRID_TAB_LAYOUT_STORAGE_KEY = "bibliteracy:grid:tabLayout";

export const GRID_TAB_LABELS: Record<GridTabId, string> = {
  journal: "Journal",
  commentary: "Commentary",
  strongs: "Strongs",
};

export const ALL_GRID_TAB_IDS: readonly GridTabId[] = [
  "journal",
  "commentary",
  "strongs",
];

export const DEFAULT_GRID_TAB_LAYOUT: GridTabLayout = {
  left: ["journal"],
  right: ["commentary", "strongs"],
};

export function paneForTab(
  layout: GridTabLayout,
  tabId: GridTabId,
): GridPane | null {
  if (layout.left.includes(tabId)) return "left";
  if (layout.right.includes(tabId)) return "right";
  return null;
}

/** Move `tabId` to `toPane` at `toIndex` (0..length inclusive). */
export function applyTabDrop(
  layout: GridTabLayout,
  tabId: GridTabId,
  toPane: GridPane,
  toIndex: number,
): GridTabLayout {
  const fromPane = paneForTab(layout, tabId);
  if (!fromPane) return layout;

  const left = [...layout.left];
  const right = [...layout.right];
  const fromList = fromPane === "left" ? left : right;
  const fromIndex = fromList.indexOf(tabId);
  if (fromIndex < 0) return layout;

  fromList.splice(fromIndex, 1);

  const toList = toPane === "left" ? left : right;
  let insertAt = Math.max(0, Math.min(toIndex, toList.length));
  if (fromPane === toPane && fromIndex < insertAt) insertAt -= 1;

  toList.splice(insertAt, 0, tabId);
  return { left, right };
}

export function parseGridTabLayout(raw: unknown): GridTabLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { left?: unknown; right?: unknown };
  if (!Array.isArray(o.left) || !Array.isArray(o.right)) return null;

  const left = o.left.filter(
    (id): id is GridTabId => typeof id === "string" && isGridTabId(id),
  );
  const right = o.right.filter(
    (id): id is GridTabId => typeof id === "string" && isGridTabId(id),
  );

  const seen = new Set<string>();
  for (const id of [...left, ...right]) {
    if (seen.has(id)) return null;
    seen.add(id);
  }

  if (seen.size !== ALL_GRID_TAB_IDS.length) return null;
  for (const id of ALL_GRID_TAB_IDS) {
    if (!seen.has(id)) return null;
  }

  return { left, right };
}

function isGridTabId(id: string): id is GridTabId {
  return (ALL_GRID_TAB_IDS as readonly string[]).includes(id);
}

export function readGridTabLayoutFromStorage(): GridTabLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GRID_TAB_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    return parseGridTabLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeGridTabLayoutToStorage(layout: GridTabLayout): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GRID_TAB_LAYOUT_STORAGE_KEY,
    JSON.stringify(layout),
  );
}
