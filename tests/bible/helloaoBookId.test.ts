import { describe, expect, it } from "vitest";
import { helloaoBookId } from "@/lib/bible/helloaoBookId";

describe("helloaoBookId", () => {
  it("uppercases standard ids", () => {
    expect(helloaoBookId("Gen")).toBe("GEN");
    expect(helloaoBookId("1Sa")).toBe("1SA");
    expect(helloaoBookId("Jhn")).toBe("JHN");
  });

  it("maps divergent ids", () => {
    expect(helloaoBookId("Joe")).toBe("JOL");
    expect(helloaoBookId("Eze")).toBe("EZK");
    expect(helloaoBookId("Nah")).toBe("NAM");
  });
});
