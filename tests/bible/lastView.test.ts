import { describe, expect, it } from "vitest";
import { parseStoredLastView } from "@/lib/bible/lastView";

describe("parseStoredLastView", () => {
  it("accepts a valid position", () => {
    expect(parseStoredLastView({ bookId: "Jhn", chapter: 3, verse: 16 })).toEqual(
      { bookId: "Jhn", chapter: 3, verse: 16 },
    );
  });

  it("rejects unknown books", () => {
    expect(
      parseStoredLastView({ bookId: "NotABook", chapter: 1, verse: 1 }),
    ).toBeNull();
  });

  it("rejects verses outside the chapter", () => {
    expect(parseStoredLastView({ bookId: "Jhn", chapter: 3, verse: 99 })).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(parseStoredLastView(null)).toBeNull();
    expect(parseStoredLastView({ bookId: "Jhn", chapter: 3 })).toBeNull();
    expect(parseStoredLastView("Jhn 3:16")).toBeNull();
  });
});
