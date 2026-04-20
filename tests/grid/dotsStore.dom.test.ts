// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "bibliteracy.dots.v1";

// jsdom's bundled Storage in vitest's jsdom env is a stub without a .clear()
// shim wired up; install a tiny in-memory replacement that satisfies the
// Storage interface used by lib/grid/dotsStore.ts.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
}

beforeEach(() => {
  const ls = new MemoryStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: ls,
  });
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
});

async function freshStore() {
  return await import("@/lib/grid/dotsStore");
}

describe("dotsStore — seed behavior", () => {
  it("seeds five demo dots when no local data exists yet", async () => {
    const store = await freshStore();
    const dot = store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    expect(dot.id).toBeTruthy();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(6); // 5 seeds + 1 new
  });

  it("recovers from corrupt JSON in localStorage by re-seeding", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");
    const store = await freshStore();
    store.createDotLocal({
      kind: "prayer",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(parsed).toHaveLength(6);
  });

  it("re-seeds when the stored value isn't an array", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "array" }));
    const store = await freshStore();
    store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(6);
  });
});

describe("dotsStore — CRUD", () => {
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, "[]");
  });

  it("creates dots with id, ownerId, timestamps", async () => {
    const store = await freshStore();
    const dot = store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      title: "Test",
      refs: [{ book: "Jhn", chapter: 3, verseStart: 16 }],
      logosTag: "logos",
      visibility: "private",
    });
    expect(dot.id).toMatch(/[a-z0-9-]/);
    expect(dot.ownerId).toBe("local-user");
    expect(dot.createdAt).toBeTruthy();
    expect(dot.updatedAt).toBe(dot.createdAt);
    expect(dot.title).toBe("Test");
    expect(dot.refs).toHaveLength(1);
  });

  it("persists to localStorage", async () => {
    const store = await freshStore();
    store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });

  it("updateDotLocal patches fields and bumps updatedAt", async () => {
    const store = await freshStore();
    const created = store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      title: "Original",
      refs: [],
      visibility: "private",
    });
    await new Promise((r) => setTimeout(r, 10));
    const updated = store.updateDotLocal(created.id, { title: "Updated" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Updated");
    expect(updated!.createdAt).toBe(created.createdAt);
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.createdAt).getTime(),
    );
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].title).toBe("Updated");
  });

  it("updateDotLocal returns null for unknown id", async () => {
    const store = await freshStore();
    const result = store.updateDotLocal("does-not-exist", { title: "X" });
    expect(result).toBeNull();
  });

  it("deleteDotLocal removes by id", async () => {
    const store = await freshStore();
    const a = store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    const b = store.createDotLocal({
      kind: "prayer",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    store.deleteDotLocal(a.id);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(b.id);
  });

  it("deleteDotLocal on unknown id is a no-op (does not throw)", async () => {
    const store = await freshStore();
    store.createDotLocal({
      kind: "logos",
      occurredOn: "2026-04-19",
      refs: [],
      visibility: "private",
    });
    expect(() => store.deleteDotLocal("missing")).not.toThrow();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });
});

describe("dotsStore — id generation", () => {
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, "[]");
  });

  it("generates unique ids across many calls", async () => {
    const store = await freshStore();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const d = store.createDotLocal({
        kind: "logos",
        occurredOn: "2026-04-19",
        refs: [],
        visibility: "private",
      });
      ids.add(d.id);
    }
    expect(ids.size).toBe(50);
  });
});
