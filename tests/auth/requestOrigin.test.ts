import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getRequestOrigin } from "@/lib/auth/requestOrigin";

function req(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers });
}

describe("getRequestOrigin", () => {
  it("uses x-forwarded-host and x-forwarded-proto on Vercel", () => {
    const origin = getRequestOrigin(
      req("http://internal/auth/callback", {
        "x-forwarded-host": "www.bibliteracy.com",
        "x-forwarded-proto": "https",
      }),
    );
    expect(origin).toBe("https://www.bibliteracy.com");
  });

  it("defaults to http for localhost host header", () => {
    const origin = getRequestOrigin(
      req("http://127.0.0.1:3000/auth/callback", {
        host: "localhost:3000",
      }),
    );
    expect(origin).toBe("http://localhost:3000");
  });

  it("falls back to request.url origin when host headers are missing", () => {
    const origin = getRequestOrigin(
      req("https://www.bibliteracy.com/auth/callback"),
    );
    expect(origin).toBe("https://www.bibliteracy.com");
  });
});
