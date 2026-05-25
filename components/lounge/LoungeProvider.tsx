"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { HostLounge } from "@/app/api/lounge/route";
import {
  readLoungeEnabled,
  writeLoungeEnabled,
} from "@/lib/lounge/storage";

export interface LoungeSession {
  roomName: string;
  displayName: string;
  livekitConfigured: boolean;
  hostLounges: HostLounge[];
}

interface LoungeContextValue {
  enabled: boolean;
  session: LoungeSession | null;
  sessionLoading: boolean;
  /** Room the bar is connected to (own lounge, or a selected host lounge). */
  activeRoomName: string | null;
  activeDisplayName: string | null;
  setActiveHostRoom(roomName: string | null): void;
  toggle(): void;
  enable(): void;
  disable(): void;
}

const LoungeContext = createContext<LoungeContextValue | null>(null);

export function LoungeProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<LoungeSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [activeHostRoom, setActiveHostRoom] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setEnabled(readLoungeEnabled());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (searchParams.get("lounge") === "1") {
      setEnabled(true);
      writeLoungeEnabled(true);
    }
  }, [hydrated, searchParams]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSignedIn(!!s?.user);
      if (!s?.user) {
        setSession(null);
        setEnabled(false);
        writeLoungeEnabled(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!signedIn || !enabled) {
      if (!enabled) setSessionLoading(false);
      return;
    }
    let cancelled = false;
    setSessionLoading(true);
    (async () => {
      const res = await fetch("/api/lounge");
      if (cancelled) return;
      if (!res.ok) {
        setSession(null);
        setSessionLoading(false);
        return;
      }
      const json = (await res.json()) as LoungeSession;
      setSession(json);
      setSessionLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, enabled]);

  const persist = useCallback((next: boolean) => {
    setEnabled(next);
    writeLoungeEnabled(next);
    if (!next) setActiveHostRoom(null);
  }, []);

  const enable = useCallback(() => persist(true), [persist]);
  const disable = useCallback(() => persist(false), [persist]);
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      writeLoungeEnabled(next);
      if (!next) setActiveHostRoom(null);
      return next;
    });
  }, []);

  const activeRoomName = useMemo(() => {
    if (!session) return null;
    if (activeHostRoom) return activeHostRoom;
    return session.roomName;
  }, [session, activeHostRoom]);

  const activeDisplayName = useMemo(() => {
    if (!session) return null;
    if (activeHostRoom) {
      const host = session.hostLounges.find(
        (h) => h.roomName === activeHostRoom,
      );
      return host ? `${session.displayName} · ${host.ownerName}'s lounge` : session.displayName;
    }
    return session.displayName;
  }, [session, activeHostRoom]);

  const value = useMemo<LoungeContextValue>(
    () => ({
      enabled: hydrated && enabled,
      session,
      sessionLoading,
      activeRoomName,
      activeDisplayName,
      setActiveHostRoom,
      toggle,
      enable,
      disable,
    }),
    [
      hydrated,
      enabled,
      session,
      sessionLoading,
      activeRoomName,
      activeDisplayName,
      toggle,
      enable,
      disable,
    ],
  );

  return (
    <LoungeContext.Provider value={value}>{children}</LoungeContext.Provider>
  );
}

export function useLounge(): LoungeContextValue {
  const ctx = useContext(LoungeContext);
  if (!ctx) {
    throw new Error("useLounge must be used within LoungeProvider");
  }
  return ctx;
}

export function useLoungeOptional(): LoungeContextValue | null {
  return useContext(LoungeContext);
}
