import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  formatTickLabel,
  fromISO,
  isMajorTick,
  isSameDay,
  startOfDay,
  toISO,
  today,
  zoomLevelFor,
  ZOOM_PX_PER_DAY,
} from "@/lib/grid/time";

describe("startOfDay / today", () => {
  it("zeros out hours/minutes/seconds/ms", () => {
    const d = new Date(2026, 3, 19, 14, 37, 22, 123);
    const s = startOfDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getMilliseconds()).toBe(0);
    expect(s.getFullYear()).toBe(2026);
    expect(s.getMonth()).toBe(3);
    expect(s.getDate()).toBe(19);
  });

  it("does not mutate its input", () => {
    const d = new Date(2026, 3, 19, 14, 37, 22, 123);
    const before = d.getTime();
    startOfDay(d);
    expect(d.getTime()).toBe(before);
  });

  it("today() is at local midnight", () => {
    const t = today();
    expect(t.getHours()).toBe(0);
    expect(t.getMinutes()).toBe(0);
  });
});

describe("addDays / diffDays / isSameDay", () => {
  it("addDays handles positive, negative, and zero", () => {
    const base = new Date(2026, 3, 19);
    expect(toISO(addDays(base, 0))).toBe("2026-04-19");
    expect(toISO(addDays(base, 1))).toBe("2026-04-20");
    expect(toISO(addDays(base, -1))).toBe("2026-04-18");
    expect(toISO(addDays(base, 30))).toBe("2026-05-19");
    expect(toISO(addDays(base, 365))).toBe("2027-04-19");
  });

  it("addDays normalizes to local midnight even when input is mid-day", () => {
    const base = new Date(2026, 3, 19, 23, 59);
    const next = addDays(base, 1);
    expect(next.getHours()).toBe(0);
    expect(toISO(next)).toBe("2026-04-20");
  });

  it("diffDays is symmetric and signed", () => {
    const a = new Date(2026, 3, 19);
    const b = new Date(2026, 3, 22);
    expect(diffDays(b, a)).toBe(3);
    expect(diffDays(a, b)).toBe(-3);
  });

  it("diffDays survives DST transitions (rounds to whole days)", () => {
    // Spring-forward in the US is March 8, 2026.
    const before = new Date(2026, 2, 7);
    const after = new Date(2026, 2, 9);
    expect(diffDays(after, before)).toBe(2);
  });

  it("isSameDay ignores time", () => {
    const a = new Date(2026, 3, 19, 1, 0);
    const b = new Date(2026, 3, 19, 23, 0);
    expect(isSameDay(a, b)).toBe(true);
    expect(isSameDay(a, addDays(a, 1))).toBe(false);
  });
});

describe("toISO / fromISO", () => {
  it("toISO pads month and day", () => {
    const d = new Date(2026, 0, 5);
    expect(toISO(d)).toBe("2026-01-05");
  });

  it("fromISO parses local-midnight YYYY-MM-DD", () => {
    const d = fromISO("2026-04-19");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(19);
    expect(d.getHours()).toBe(0);
  });

  it("fromISO/toISO roundtrip is stable across many dates", () => {
    const samples = [
      "2000-01-01",
      "2024-02-29",
      "2025-12-31",
      "2026-04-19",
      "2030-07-04",
      "2099-11-11",
    ];
    for (const s of samples) {
      expect(toISO(fromISO(s))).toBe(s);
    }
  });
});

describe("zoomLevelFor", () => {
  it("returns each level at the canonical px/day", () => {
    expect(zoomLevelFor(ZOOM_PX_PER_DAY.day)).toBe("day");
    expect(zoomLevelFor(ZOOM_PX_PER_DAY.week)).toBe("week");
    expect(zoomLevelFor(ZOOM_PX_PER_DAY.month)).toBe("month");
    expect(zoomLevelFor(ZOOM_PX_PER_DAY.quarter)).toBe("quarter");
    expect(zoomLevelFor(ZOOM_PX_PER_DAY.year)).toBe("year");
  });

  it("falls into the next-coarser bucket below the threshold", () => {
    expect(zoomLevelFor(55)).toBe("week");
    expect(zoomLevelFor(19)).toBe("month");
    expect(zoomLevelFor(7)).toBe("quarter");
    expect(zoomLevelFor(2)).toBe("year");
    expect(zoomLevelFor(0.1)).toBe("year");
  });

  it("is monotone non-increasing in level coarseness as px/day decreases", () => {
    const order = ["day", "week", "month", "quarter", "year"] as const;
    // Sweep over a finite, geometrically-spaced sample of px/day values.
    const samples: number[] = [];
    for (let px = 1000; px >= 0.01; px /= 1.5) samples.push(px);
    let last = order.indexOf(zoomLevelFor(samples[0]));
    for (const px of samples) {
      const idx = order.indexOf(zoomLevelFor(px));
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
    }
  });
});

describe("isMajorTick", () => {
  const monday = new Date(2026, 3, 20); // Monday 2026-04-20
  const tuesday = new Date(2026, 3, 21);
  const firstOfMonth = new Date(2026, 6, 1); // Wed Jul 1 2026
  const firstOfQuarter = new Date(2026, 3, 1); // Wed Apr 1 2026
  const firstOfYear = new Date(2026, 0, 1);

  it("day zoom: every day is major", () => {
    expect(isMajorTick(tuesday, "day")).toBe(true);
    expect(isMajorTick(monday, "day")).toBe(true);
  });

  it("week zoom: only Mondays are major", () => {
    expect(isMajorTick(monday, "week")).toBe(true);
    expect(isMajorTick(tuesday, "week")).toBe(false);
  });

  it("month zoom: only the 1st is major", () => {
    expect(isMajorTick(firstOfMonth, "month")).toBe(true);
    expect(isMajorTick(monday, "month")).toBe(false);
  });

  it("quarter zoom: 1st of Jan/Apr/Jul/Oct only", () => {
    expect(isMajorTick(firstOfQuarter, "quarter")).toBe(true);
    expect(isMajorTick(firstOfMonth, "quarter")).toBe(true); // July 1
    expect(isMajorTick(firstOfYear, "quarter")).toBe(true);
    expect(isMajorTick(new Date(2026, 1, 1), "quarter")).toBe(false); // Feb 1
  });

  it("year zoom: only Jan 1 is major", () => {
    expect(isMajorTick(firstOfYear, "year")).toBe(true);
    expect(isMajorTick(firstOfQuarter, "year")).toBe(false);
  });
});

describe("formatTickLabel", () => {
  const apr19 = new Date(2026, 3, 19);
  const jan1 = new Date(2026, 0, 1);
  const jul15 = new Date(2026, 6, 15);

  it("day/week show short month + day-of-month", () => {
    expect(formatTickLabel(apr19, "day")).toBe("Apr 19");
    expect(formatTickLabel(apr19, "week")).toBe("Apr 19");
  });

  it("month shows month, prefixing year for January", () => {
    expect(formatTickLabel(jul15, "month")).toBe("Jul");
    expect(formatTickLabel(jan1, "month")).toBe("Jan 2026");
  });

  it("quarter and year show year only", () => {
    expect(formatTickLabel(apr19, "quarter")).toBe("2026");
    expect(formatTickLabel(apr19, "year")).toBe("2026");
  });
});
