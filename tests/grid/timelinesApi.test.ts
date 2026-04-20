import { describe, expect, it } from "vitest";
import {
  clampAnchor,
  clampSubdivisions,
  computeSortOrderForMove,
  rowToTimeline,
  TIMELINE_APPEARANCE_DEFAULTS,
  type Timeline,
} from "@/lib/grid/timelinesApi";

function tl(id: string, sortOrder: number): Timeline {
  return {
    id,
    ownerId: "u",
    name: id,
    sortOrder,
    builtinKind: null,
    color: null,
    heightPreset: "normal",
    showDayCells: true,
    showTodayHighlight: true,
    gridSubdivisions: 1,
    verticalAnchor: 0.5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("computeSortOrderForMove", () => {
  const list = [tl("a", 0), tl("b", 1), tl("c", 2), tl("d", 3)];

  it("returns null for unknown ids", () => {
    expect(computeSortOrderForMove(list, "zzz", 0)).toBeNull();
  });

  it("returns null when the move is a no-op", () => {
    expect(computeSortOrderForMove(list, "b", 1)).toBeNull();
  });

  it("moves to the head by placing sort_order below the current first", () => {
    const v = computeSortOrderForMove(list, "c", 0);
    expect(v).not.toBeNull();
    expect(v!).toBeLessThan(0);
  });

  it("moves to the tail by placing sort_order above the current last", () => {
    const v = computeSortOrderForMove(list, "a", 3);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(3);
  });

  it("moves between two items using the neighbour midpoint", () => {
    // Moving 'd' to between 'a' and 'b': neighbours are a(0) and b(1) → 0.5.
    expect(computeSortOrderForMove(list, "d", 1)).toBe(0.5);
  });

  it("clamps an oversized target to the list tail", () => {
    const v = computeSortOrderForMove(list, "a", 99);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(3);
  });

  it("handles a single-item list (degenerate: no-op)", () => {
    expect(computeSortOrderForMove([tl("only", 5)], "only", 0)).toBeNull();
  });
});

describe("clampSubdivisions", () => {
  it("clamps into [0, 8] and rounds fractional inputs", () => {
    expect(clampSubdivisions(-5)).toBe(0);
    expect(clampSubdivisions(99)).toBe(8);
    expect(clampSubdivisions(3.4)).toBe(3);
    expect(clampSubdivisions(3.6)).toBe(4);
  });

  it("returns the default for non-finite inputs", () => {
    expect(clampSubdivisions(Number.NaN)).toBe(
      TIMELINE_APPEARANCE_DEFAULTS.gridSubdivisions,
    );
    expect(clampSubdivisions(Number.POSITIVE_INFINITY)).toBe(
      TIMELINE_APPEARANCE_DEFAULTS.gridSubdivisions,
    );
  });
});

describe("clampAnchor", () => {
  it("clamps into [0, 1]", () => {
    expect(clampAnchor(-0.5)).toBe(0);
    expect(clampAnchor(1.5)).toBe(1);
    expect(clampAnchor(0.25)).toBe(0.25);
  });

  it("returns the default for non-finite inputs", () => {
    expect(clampAnchor(Number.NaN)).toBe(
      TIMELINE_APPEARANCE_DEFAULTS.verticalAnchor,
    );
  });
});

describe("rowToTimeline", () => {
  const baseRow = {
    id: "11111111-1111-1111-1111-111111111111",
    owner_id: "22222222-2222-2222-2222-222222222222",
    name: "Lane",
    sort_order: 0,
    builtin_kind: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("maps full appearance columns through", () => {
    const t = rowToTimeline({
      ...baseRow,
      color: "#ff00aa",
      height_preset: "tall",
      show_day_cells: false,
      show_today_highlight: false,
      grid_subdivisions: 4,
      vertical_anchor: 0.2,
    });
    expect(t.color).toBe("#ff00aa");
    expect(t.heightPreset).toBe("tall");
    expect(t.showDayCells).toBe(false);
    expect(t.showTodayHighlight).toBe(false);
    expect(t.gridSubdivisions).toBe(4);
    expect(t.verticalAnchor).toBe(0.2);
  });

  it("falls back to appearance defaults when columns are missing/null", () => {
    // Simulates a row written before the timeline_appearance migration, or a
    // cache line kept around from an older client build.
    const t = rowToTimeline(baseRow);
    expect(t.color).toBe(TIMELINE_APPEARANCE_DEFAULTS.color);
    expect(t.heightPreset).toBe(TIMELINE_APPEARANCE_DEFAULTS.heightPreset);
    expect(t.showDayCells).toBe(TIMELINE_APPEARANCE_DEFAULTS.showDayCells);
    expect(t.showTodayHighlight).toBe(
      TIMELINE_APPEARANCE_DEFAULTS.showTodayHighlight,
    );
    expect(t.gridSubdivisions).toBe(
      TIMELINE_APPEARANCE_DEFAULTS.gridSubdivisions,
    );
    expect(t.verticalAnchor).toBe(
      TIMELINE_APPEARANCE_DEFAULTS.verticalAnchor,
    );
  });

  it("clamps out-of-range subdivisions and anchor from the DB", () => {
    const t = rowToTimeline({
      ...baseRow,
      grid_subdivisions: 42,
      vertical_anchor: -3,
    });
    expect(t.gridSubdivisions).toBe(8);
    expect(t.verticalAnchor).toBe(0);
  });
});
