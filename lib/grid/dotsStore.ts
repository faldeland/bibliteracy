"use client";

import { useEffect, useState } from "react";
import type { Dot } from "./types";
import { toISO } from "./time";

const STORAGE_KEY = "bibliteracy.dots.v1";

function readAll(): Dot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function writeAll(dots: Dot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dots));
}

/**
 * A small reactive store for dots backed by localStorage. M2 will replace this
 * with a Supabase-backed implementation that exposes the same hook signature.
 */
const listeners = new Set<() => void>();

let cache: Dot[] | null = null;

function ensureCache(): Dot[] {
  if (cache === null) cache = readAll();
  return cache;
}

function emit() {
  for (const l of listeners) l();
}

export function useDotsLocal() {
  const [dots, setDots] = useState<Dot[]>(ensureCache);

  useEffect(() => {
    const onChange = () => setDots([...ensureCache()]);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return dots;
}

export function createDotLocal(
  partial: Omit<Dot, "id" | "ownerId" | "createdAt" | "updatedAt">,
): Dot {
  const now = new Date().toISOString();
  const dot: Dot = {
    ...partial,
    id: cryptoRandomId(),
    ownerId: "local-user",
    createdAt: now,
    updatedAt: now,
  };
  const next = [...ensureCache(), dot];
  cache = next;
  writeAll(next);
  emit();
  return dot;
}

export function deleteDotLocal(id: string) {
  const next = ensureCache().filter((d) => d.id !== id);
  cache = next;
  writeAll(next);
  emit();
}

export function updateDotLocal(
  id: string,
  patch: Partial<Omit<Dot, "id" | "ownerId" | "createdAt">>,
): Dot | null {
  const list = ensureCache();
  const idx = list.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const updated: Dot = {
    ...list[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[idx] = updated;
  cache = next;
  writeAll(next);
  emit();
  return updated;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function seed(): Dot[] {
  const t = new Date();
  const iso = (offset: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() + offset);
    return toISO(d);
  };
  const now = new Date().toISOString();
  return [
    {
      id: "seed-1",
      ownerId: "local-user",
      kind: "logos",
      occurredOn: iso(0),
      title: "Lectio: John 1:1-5",
      bodyMd:
        "In the beginning was the Word… The light shines in the darkness, and the darkness has not overcome it.",
      refs: [{ book: "Jhn", chapter: 1, verseStart: 1, verseEnd: 5 }],
      logosTag: "both",
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-2",
      ownerId: "local-user",
      kind: "prayer",
      occurredOn: iso(0),
      title: "Morning examen",
      bodyMd: "Gratitude · Petition · Surrender",
      refs: [{ book: "Psa", chapter: 51 }],
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-3",
      ownerId: "local-user",
      kind: "discipleship",
      occurredOn: iso(-2),
      title: "Note for J: keep going",
      bodyMd: "Sent a short audio encouragement on Romans 8.",
      refs: [{ book: "Rom", chapter: 8 }],
      visibility: "guests",
      livekitRoomName: "dot_seed3",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-4",
      ownerId: "local-user",
      kind: "prayer",
      occurredOn: iso(-7),
      title: "For the city",
      bodyMd: "",
      refs: [],
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-5",
      ownerId: "local-user",
      kind: "logos",
      occurredOn: iso(-14),
      title: "Genesis 1 — pattern of days",
      bodyMd: "Form / fill structure across the six days.",
      refs: [{ book: "Gen", chapter: 1 }],
      logosTag: "logos",
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    },
  ];
}
