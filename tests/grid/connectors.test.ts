import { describe, expect, it } from "vitest";
import {
  buildConnectorEdges,
  refFraction,
} from "@/lib/grid/connectors";
import type { Dot } from "@/lib/grid/types";

function mkDot(
  id: string,
  refs: Dot["refs"],
  overrides: Partial<Dot> = {},
): Dot {
  return {
    id,
    ownerId: "u",
    kind: "logos",
    occurredOn: "2026-04-19",
    refs,
    tags: [],
    visibility: "private",
    createdAt: "2026-04-19T00:00:00Z",
    updatedAt: "2026-04-19T00:00:00Z",
    ...overrides,
  };
}

describe("buildConnectorEdges", () => {
  const d1 = mkDot("d1", [
    { book: "Jhn", chapter: 3, verseStart: 16 },
    { book: "Rom", chapter: 8 },
  ]);
  const d2 = mkDot("d2", [{ book: "Jhn", chapter: 1 }]);
  const d3 = mkDot("d3", []);
  const dots = [d1, d2, d3];

  it("returns no edges when nothing is hovered, selected, or showAll", () => {
    expect(
      buildConnectorEdges({
        dots,
        hoverDotId: null,
        hoverBookId: null,
        selectedBookId: null,
        showAll: false,
      }),
    ).toEqual([]);
  });

  it("showAll: one edge per (dot, distinct-book) pair", () => {
    const edges = buildConnectorEdges({
      dots,
      hoverDotId: null,
      hoverBookId: null,
      selectedBookId: null,
      showAll: true,
    });
    // d1: Jhn + Rom, d2: Jhn, d3: none = 3 edges total
    expect(edges).toHaveLength(3);
    expect(new Set(edges.map((e) => e.dotId))).toEqual(new Set(["d1", "d2"]));
    expect(edges.every((e) => e.weight === 0.5)).toBe(true);
  });

  it("showAll dedupes when a dot references the same book twice", () => {
    const d = mkDot("dup", [
      { book: "Jhn", chapter: 1 },
      { book: "Jhn", chapter: 3, verseStart: 16 },
    ]);
    const edges = buildConnectorEdges({
      dots: [d],
      hoverDotId: null,
      hoverBookId: null,
      selectedBookId: null,
      showAll: true,
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].bookId).toBe("Jhn");
  });

  it("selectedBookId: emits one edge for every dot referencing it", () => {
    const edges = buildConnectorEdges({
      dots,
      hoverDotId: null,
      hoverBookId: null,
      selectedBookId: "Jhn",
      showAll: false,
    });
    expect(edges).toHaveLength(2);
    expect(edges.map((e) => e.dotId).sort()).toEqual(["d1", "d2"]);
    expect(edges.every((e) => e.bookId === "Jhn")).toBe(true);
  });

  it("hoverDotId: emits one edge per ref of the hovered dot (highest weight)", () => {
    const edges = buildConnectorEdges({
      dots,
      hoverDotId: "d1",
      hoverBookId: null,
      selectedBookId: null,
      showAll: false,
    });
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.dotId === "d1")).toBe(true);
    expect(edges.every((e) => e.weight === 1)).toBe(true);
  });

  it("hoverBookId: emits one edge per dot referencing the hovered book", () => {
    const edges = buildConnectorEdges({
      dots,
      hoverDotId: null,
      hoverBookId: "Jhn",
      selectedBookId: null,
      showAll: false,
    });
    expect(edges.map((e) => e.dotId).sort()).toEqual(["d1", "d2"]);
    expect(edges.every((e) => e.bookId === "Jhn")).toBe(true);
  });

  it("dedupes across overlapping reasons (hover vs select)", () => {
    const edges = buildConnectorEdges({
      dots,
      hoverDotId: "d1",
      hoverBookId: null,
      selectedBookId: "Jhn",
      showAll: false,
    });
    // d1 -> Jhn appears from both select and hover but must appear once.
    const jhn = edges.filter((e) => e.dotId === "d1" && e.bookId === "Jhn");
    expect(jhn).toHaveLength(1);
  });
});

describe("refFraction", () => {
  it("returns 0.5 when ref is missing", () => {
    expect(refFraction("Jhn")).toBe(0.5);
  });

  it("returns 0.5 for unknown books", () => {
    expect(refFraction("NotABook", { book: "NotABook", chapter: 1 })).toBe(0.5);
  });

  it("chapter 1 of a multi-chapter book lands in the first slice", () => {
    const frac = refFraction("Jhn", { book: "Jhn", chapter: 1 });
    expect(frac).toBeGreaterThanOrEqual(0);
    expect(frac).toBeLessThan(0.2);
  });

  it("final chapter lands in the last slice", () => {
    // John has 21 chapters.
    const frac = refFraction("Jhn", { book: "Jhn", chapter: 21 });
    expect(frac).toBeLessThanOrEqual(1);
    expect(frac).toBeGreaterThan(0.9);
  });

  it("clamps chapters above the book's chapter count", () => {
    const frac = refFraction("Jhn", { book: "Jhn", chapter: 999 });
    expect(frac).toBeLessThanOrEqual(1);
  });

  it("uses verseStart to nudge inside the chapter slice", () => {
    const start = refFraction("Jhn", {
      book: "Jhn",
      chapter: 3,
      verseStart: 1,
    });
    const end = refFraction("Jhn", {
      book: "Jhn",
      chapter: 3,
      verseStart: 30,
    });
    expect(end).toBeGreaterThan(start);
  });
});
