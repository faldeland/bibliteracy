import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verseIndex } from "@/lib/bible/globalVerseIndex";
import {
  loadStrongsOccurrences,
  resetStrongsClientCache,
} from "@/lib/bible/strongsClient";

describe("strongsClient", () => {
  beforeEach(() => {
    resetStrongsClientCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (!url.includes("strong=G2316")) {
          return new Response(JSON.stringify({ error: "not found" }), {
            status: 404,
          });
        }
        return new Response(
          JSON.stringify({
            strong: "G2316",
            count: 2,
            verses: [
              { book: "Jhn", chapter: 3, verse: 16 },
              { book: "Gen", chapter: 1, verse: 1 },
            ],
          }),
          { status: 200 },
        );
      }),
    );
  });

  afterEach(() => {
    resetStrongsClientCache();
    vi.unstubAllGlobals();
  });

  it("maps API verses to sorted global indices", async () => {
    const data = await loadStrongsOccurrences("G2316");
    expect(data.strong).toBe("G2316");
    expect(data.count).toBe(2);
    expect(data.indices.length).toBe(2);
    const jhn = verseIndex("Jhn", 3, 16)!;
    const gen = verseIndex("Gen", 1, 1)!;
    expect(data.indices[0]).toBe(jhn);
    expect(data.indices[1]).toBe(gen);
  });

  it("deduplicates fetch per Strong's number", async () => {
    const fetchMock = vi.mocked(fetch);
    await loadStrongsOccurrences("G2316");
    await loadStrongsOccurrences("G2316");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
