import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/bible/xrefs/route";

function makeReq(qs: string) {
  return new Request(`http://localhost/api/bible/xrefs${qs}`) as unknown as
    import("next/server").NextRequest;
}

interface XRefBody {
  query?: { book: string; chapter: number; verseStart?: number };
  label?: string;
  count: number;
  results: Array<{
    to: { book: string; chapter: number };
    toLabel: string;
    category: string;
    note: string;
  }>;
  error?: string;
}

describe("GET /api/bible/xrefs", () => {
  it("400s without any query parameters", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
    const body = (await res.json()) as XRefBody;
    expect(body.error).toBeTruthy();
  });

  it("400s on an unparseable reference", async () => {
    const res = await GET(makeReq("?ref=NotABook+99"));
    expect(res.status).toBe(400);
  });

  it("returns hits for ?ref=John+3:16", async () => {
    const res = await GET(makeReq("?ref=John+3:16"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as XRefBody;
    expect(body.label).toBe("John 3:16");
    expect(body.count).toBeGreaterThan(0);
    expect(body.results[0].toLabel).toBeTruthy();
  });

  it("returns hits for ?book=Psa&chapter=110&verse=1 (most-quoted OT verse)", async () => {
    const res = await GET(makeReq("?book=Psa&chapter=110&verse=1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as XRefBody;
    const targetBooks = body.results.map((r) => r.to.book);
    expect(targetBooks).toEqual(
      expect.arrayContaining(["Mat", "Mrk", "Luk", "Act", "Heb"]),
    );
  });

  it("returns count: 0 for a real but non-curated passage", async () => {
    const res = await GET(makeReq("?ref=3+John+1:5"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as XRefBody;
    expect(body.count).toBe(0);
    expect(body.results).toEqual([]);
  });

  it("sets long-lived cache-control headers", async () => {
    const res = await GET(makeReq("?ref=John+3:16"));
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toMatch(/max-age/);
    expect(cc).toMatch(/s-maxage/);
  });
});
