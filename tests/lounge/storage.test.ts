/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  LOUNGE_ENABLED_KEY,
  readLoungeEnabled,
  writeLoungeEnabled,
} from "@/lib/lounge/storage";

describe("lounge storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads false when unset", () => {
    expect(readLoungeEnabled()).toBe(false);
  });

  it("persists enabled state", () => {
    writeLoungeEnabled(true);
    expect(localStorage.getItem(LOUNGE_ENABLED_KEY)).toBe("1");
    expect(readLoungeEnabled()).toBe(true);
    writeLoungeEnabled(false);
    expect(localStorage.getItem(LOUNGE_ENABLED_KEY)).toBeNull();
    expect(readLoungeEnabled()).toBe(false);
  });
});
