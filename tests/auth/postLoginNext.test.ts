import { describe, expect, it } from "vitest";
import {
  resolvePostLoginPath,
  safePostLoginPath,
} from "@/lib/auth/postLoginNext";

describe("safePostLoginPath", () => {
  it("allows relative paths", () => {
    expect(safePostLoginPath("/settings")).toBe("/settings");
  });

  it("rejects open redirects", () => {
    expect(safePostLoginPath("//evil.com")).toBe("/");
    expect(safePostLoginPath("https://evil.com")).toBe("/");
  });
});

describe("resolvePostLoginPath", () => {
  it("prefers the query param over the cookie", () => {
    expect(resolvePostLoginPath("/from-query", "/from-cookie")).toBe(
      "/from-query",
    );
  });

  it("falls back to the cookie when the query param is absent", () => {
    expect(resolvePostLoginPath(null, "%2Fsettings")).toBe("/settings");
  });
});
