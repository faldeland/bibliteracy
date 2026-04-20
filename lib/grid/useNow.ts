"use client";

import { useEffect, useState } from "react";
import { today } from "./time";

/**
 * Module-level shared state for the "what day is it right now" value. One
 * interval across the whole app keeps every lane / ruler in sync without
 * each of them registering its own `setInterval`.
 */
let currentNow: Date = today();
const listeners = new Set<(d: Date) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureInterval() {
  if (intervalId !== null || typeof window === "undefined") return;
  intervalId = setInterval(() => {
    const next = today();
    if (next.getTime() === currentNow.getTime()) return;
    currentNow = next;
    for (const l of listeners) l(next);
  }, 60_000);
}

/**
 * Returns today's date, ticking at most once per minute (and only when the
 * day actually rolls over). Safe to call from any client component.
 */
export function useNow(): Date {
  const [now, setNow] = useState<Date>(currentNow);

  useEffect(() => {
    ensureInterval();
    const listener = (d: Date) => setNow(d);
    listeners.add(listener);
    // Sync in case the module-level value advanced between renders.
    if (now.getTime() !== currentNow.getTime()) setNow(currentNow);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return now;
}
