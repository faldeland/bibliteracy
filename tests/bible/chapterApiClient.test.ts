import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bibleApiPath,
  fetchChapterFromApi,
} from "@/lib/bible/chapterApiClient";

describe("bibleApiPath", () => {
  it("prefixes NEXT_PUBLIC_BASE_PATH when set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/myapp");
    expect(bibleApiPath("/api/bible/chapter?x=1")).toBe(
      "/myapp/api/bible/chapter?x=1",
    );
    vi.unstubAllEnvs();
  });

  it("strips trailing slash from base", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/myapp/");
    expect(bibleApiPath("/api/x")).toBe("/myapp/api/x");
    vi.unstubAllEnvs();
  });
});

describe("fetchChapterFromApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              book: "Jhn",
              chapter: 3,
              verses: [{ verse: 1, tokens: [], plain: "Hi" }],
            }),
          ),
      }),
    );
    const data = await fetchChapterFromApi("Jhn", 3, "KJV");
    expect(data.book).toBe("Jhn");
    expect(data.verses).toHaveLength(1);
  });

  it("returns body with error field on 501 (missing API key)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 501,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              book: "Jhn",
              chapter: 3,
              translation: "ESV",
              error: "ESV requires the ESV_API_KEY environment variable.",
              configMissing: "ESV_API_KEY",
            }),
          ),
      }),
    );
    const data = await fetchChapterFromApi("Jhn", 3, "ESV");
    expect(data.error).toBeTruthy();
    expect(data.configMissing).toBe("ESV_API_KEY");
  });

  it("throws a helpful message on generic network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(fetchChapterFromApi("Jhn", 3, "KJV")).rejects.toThrow(
      /Network error/,
    );
  });

  it("re-aborts when fetch throws AbortError", async () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
    await expect(fetchChapterFromApi("Jhn", 3, "KJV")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
