// Zustand is happy in node and we drive the store directly via
// setState/getState, no React renderer needed.

import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PX_PER_DAY,
  MIN_PX_PER_DAY,
  useGridStore,
} from "@/lib/grid/state";
import { addDays, today, ZOOM_PX_PER_DAY } from "@/lib/grid/time";

beforeEach(() => {
  // Reset the store between tests by replacing the slice we exercise.
  useGridStore.setState({
    pxPerDay: ZOOM_PX_PER_DAY.week,
    centerDate: today(),
    selectedBookId: null,
    bibleNavigationSeq: 0,
    bibleNavigationTarget: null,
    pinnedStrong: null,
  });
});

describe("useGridStore — pinnedStrong", () => {
  it("stores and clears the pinned Strong's number", () => {
    useGridStore.getState().setPinnedStrong("G2316");
    expect(useGridStore.getState().pinnedStrong).toBe("G2316");
    useGridStore.getState().setPinnedStrong(null);
    expect(useGridStore.getState().pinnedStrong).toBeNull();
  });
});

describe("useGridStore — navigateBible", () => {
  it("bumps seq and stores the target ref", () => {
    const ref = { book: "Jhn", chapter: 3, verseStart: 16 };
    useGridStore.getState().navigateBible(ref);
    const s = useGridStore.getState();
    expect(s.bibleNavigationSeq).toBe(1);
    expect(s.bibleNavigationTarget).toEqual(ref);
  });
});

describe("useGridStore — setPxPerDay", () => {
  it("clamps below the min", () => {
    useGridStore.getState().setPxPerDay(-100);
    expect(useGridStore.getState().pxPerDay).toBe(MIN_PX_PER_DAY);
  });

  it("clamps above the max", () => {
    useGridStore.getState().setPxPerDay(10_000);
    expect(useGridStore.getState().pxPerDay).toBe(MAX_PX_PER_DAY);
  });

  it("accepts in-range values", () => {
    useGridStore.getState().setPxPerDay(50);
    expect(useGridStore.getState().pxPerDay).toBe(50);
  });
});

describe("useGridStore — panByPx", () => {
  it("snaps to whole days when panning", () => {
    const before = useGridStore.getState().centerDate;
    // pxPerDay defaults to ZOOM_PX_PER_DAY.week (32). Pan 100 px → 100/32 ≈ 3.13 → 3 days.
    useGridStore.getState().panByPx(100);
    const after = useGridStore.getState().centerDate;
    const expected = addDays(before, 3);
    expect(after.toDateString()).toBe(expected.toDateString());
  });

  it("does nothing when the pan rounds to zero days", () => {
    const before = useGridStore.getState().centerDate;
    useGridStore.getState().panByPx(0.4); // < 0.5 days at any sane zoom
    expect(useGridStore.getState().centerDate.toDateString()).toBe(
      before.toDateString(),
    );
  });

  it("pans backward with negative px", () => {
    const before = useGridStore.getState().centerDate;
    useGridStore.getState().panByPx(-100);
    const after = useGridStore.getState().centerDate;
    const expected = addDays(before, -3);
    expect(after.toDateString()).toBe(expected.toDateString());
  });
});

describe("useGridStore — zoomAt", () => {
  it("does nothing when the new px-per-day equals the current one", () => {
    const before = useGridStore.getState();
    useGridStore.getState().zoomAt({
      newPxPerDay: before.pxPerDay,
      cursorPx: 600,
      viewportPx: 1280,
    });
    const after = useGridStore.getState();
    expect(after.pxPerDay).toBe(before.pxPerDay);
    expect(after.centerDate.toDateString()).toBe(before.centerDate.toDateString());
  });

  it("clamps the new px-per-day", () => {
    useGridStore.getState().zoomAt({
      newPxPerDay: 9999,
      cursorPx: 0,
      viewportPx: 1280,
    });
    expect(useGridStore.getState().pxPerDay).toBe(MAX_PX_PER_DAY);

    useGridStore.getState().zoomAt({
      newPxPerDay: -50,
      cursorPx: 0,
      viewportPx: 1280,
    });
    expect(useGridStore.getState().pxPerDay).toBe(MIN_PX_PER_DAY);
  });

  it("recenters so the day under the cursor stays put when zooming at center", () => {
    // When cursor is at viewport center, daysFromCenter = 0 so zooming
    // shouldn't move the centerDate at all.
    const before = useGridStore.getState().centerDate;
    useGridStore.getState().zoomAt({
      newPxPerDay: 80,
      cursorPx: 640,
      viewportPx: 1280,
    });
    expect(useGridStore.getState().centerDate.toDateString()).toBe(
      before.toDateString(),
    );
    expect(useGridStore.getState().pxPerDay).toBe(80);
  });
});

describe("useGridStore — setZoom / recenterOnToday / selectedBook", () => {
  it("setZoom snaps to canonical px-per-day for each level", () => {
    const s = useGridStore.getState();
    s.setZoom("day");
    expect(useGridStore.getState().pxPerDay).toBe(ZOOM_PX_PER_DAY.day);
    s.setZoom("year");
    expect(useGridStore.getState().pxPerDay).toBe(ZOOM_PX_PER_DAY.year);
  });

  it("recenterOnToday resets centerDate to today (zeroed time)", () => {
    useGridStore.setState({ centerDate: addDays(today(), 30) });
    useGridStore.getState().recenterOnToday();
    const c = useGridStore.getState().centerDate;
    const t = today();
    expect(c.getFullYear()).toBe(t.getFullYear());
    expect(c.getMonth()).toBe(t.getMonth());
    expect(c.getDate()).toBe(t.getDate());
    expect(c.getHours()).toBe(0);
  });

  it("setSelectedBookId stores and clears the id", () => {
    useGridStore.getState().setSelectedBookId("Jhn");
    expect(useGridStore.getState().selectedBookId).toBe("Jhn");
    useGridStore.getState().setSelectedBookId(null);
    expect(useGridStore.getState().selectedBookId).toBeNull();
  });

  it("setCenterDate stores the date verbatim", () => {
    const target = new Date(2030, 5, 15);
    useGridStore.getState().setCenterDate(target);
    expect(useGridStore.getState().centerDate.getTime()).toBe(target.getTime());
  });
});
