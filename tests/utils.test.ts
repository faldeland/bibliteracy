import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className combiner)", () => {
  it("joins truthy strings with single spaces", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops false / null / undefined", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("drops empty strings", () => {
    expect(cn("", "a", "")).toBe("a");
  });

  it("returns an empty string when given nothing truthy", () => {
    expect(cn()).toBe("");
    expect(cn(false, null, undefined, "")).toBe("");
  });

  it("preserves caller-supplied internal whitespace verbatim", () => {
    expect(cn("a b", "c  d")).toBe("a b c  d");
  });
});
