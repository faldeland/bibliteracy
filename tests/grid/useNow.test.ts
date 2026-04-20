// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { today } from "@/lib/grid/time";

describe("useNow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's date as its initial value", async () => {
    const { useNow } = await import("@/lib/grid/useNow");
    const { result } = renderHook(() => useNow());
    expect(result.current.getTime()).toBe(today().getTime());
  });

  it("does not tick when the day has not changed", async () => {
    const { useNow } = await import("@/lib/grid/useNow");
    const { result } = renderHook(() => useNow());
    const initial = result.current;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(initial);
  });

  it("installs at most one interval per module instance, even with many consumers", async () => {
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const { useNow } = await import("@/lib/grid/useNow");
    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    const c = renderHook(() => useNow());
    // Fresh module → at most one setInterval call across the three mounts.
    expect(setSpy.mock.calls.length).toBeLessThanOrEqual(1);
    a.unmount();
    b.unmount();
    c.unmount();
    setSpy.mockRestore();
  });
});
