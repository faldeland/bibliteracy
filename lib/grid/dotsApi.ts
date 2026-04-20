"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  createDotLocal,
  deleteDotLocal,
  updateDotLocal,
  useDotsLocal,
} from "./dotsStore";
import type { Dot } from "./types";

export type DotUpdate = Partial<Omit<Dot, "id" | "ownerId" | "createdAt" | "updatedAt">>;

export interface DotsApi {
  dots: Dot[];
  isLoading: boolean;
  /** True when the app is running against Supabase + a signed-in user. */
  isCloud: boolean;
  userId: string | null;
  createDot(
    partial: Omit<Dot, "id" | "ownerId" | "createdAt" | "updatedAt">,
  ): Promise<void>;
  updateDot(id: string, patch: DotUpdate): Promise<void>;
  deleteDot(id: string): Promise<void>;
}

/**
 * Unified data hook. Uses Supabase when configured AND the user is signed in,
 * otherwise falls back to the localStorage store so the app remains fully
 * usable in dev without a backend.
 */
export function useDots(): DotsApi {
  const localDots = useDotsLocal();
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudDots, setCloudDots] = useState<Dot[] | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Watch auth state.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = supabaseRef.current ?? createClient();
    supabaseRef.current = supabase;

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  // Fetch + subscribe to dots when in cloud mode.
  useEffect(() => {
    if (!supabaseConfigured || !userId) {
      setCloudDots(null);
      return;
    }
    const supabase = supabaseRef.current!;
    let mounted = true;
    setLoadingCloud(true);

    (async () => {
      const { data, error } = await supabase
        .from("dots")
        .select("*")
        .order("occurred_on", { ascending: true });
      if (!mounted) return;
      if (error) {
        console.error("[dots] fetch error", error);
        setCloudDots([]);
      } else {
        setCloudDots((data ?? []).map(rowToDot));
      }
      setLoadingCloud(false);
    })();

    const channel = supabase
      .channel(`dots-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dots" },
        (payload) => {
          setCloudDots((prev) => {
            if (!prev) return prev;
            if (payload.eventType === "INSERT") {
              return [...prev, rowToDot(payload.new)];
            }
            if (payload.eventType === "UPDATE") {
              const updated = rowToDot(payload.new);
              return prev.map((d) => (d.id === updated.id ? updated : d));
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return prev.filter((d) => d.id !== id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabaseConfigured, userId]);

  const isCloud = supabaseConfigured && !!userId;

  return {
    dots: isCloud ? cloudDots ?? [] : localDots,
    isLoading: isCloud ? loadingCloud : false,
    isCloud,
    userId,
    async createDot(partial) {
      if (!isCloud) {
        createDotLocal(partial);
        return;
      }
      const supabase = supabaseRef.current!;
      const { error } = await supabase.from("dots").insert({
        owner_id: userId,
        kind: partial.kind,
        occurred_on: partial.occurredOn,
        title: partial.title ?? null,
        body_md: partial.bodyMd ?? null,
        refs: partial.refs ?? [],
        logos_tag: partial.logosTag ?? null,
        visibility: partial.visibility,
        livekit_room_name: partial.livekitRoomName ?? null,
        scheduled_for: partial.scheduledFor ?? null,
      });
      if (error) console.error("[dots] insert error", error);
    },
    async updateDot(id, patch) {
      if (!isCloud) {
        updateDotLocal(id, patch);
        return;
      }
      const supabase = supabaseRef.current!;
      const row: Record<string, unknown> = {};
      if (patch.kind !== undefined) row.kind = patch.kind;
      if (patch.occurredOn !== undefined) row.occurred_on = patch.occurredOn;
      if (patch.title !== undefined) row.title = patch.title ?? null;
      if (patch.bodyMd !== undefined) row.body_md = patch.bodyMd ?? null;
      if (patch.refs !== undefined) row.refs = patch.refs;
      if (patch.logosTag !== undefined) row.logos_tag = patch.logosTag ?? null;
      if (patch.visibility !== undefined) row.visibility = patch.visibility;
      if (patch.livekitRoomName !== undefined)
        row.livekit_room_name = patch.livekitRoomName ?? null;
      if (patch.scheduledFor !== undefined)
        row.scheduled_for = patch.scheduledFor ?? null;
      const { error } = await supabase.from("dots").update(row).eq("id", id);
      if (error) console.error("[dots] update error", error);
    },
    async deleteDot(id) {
      if (!isCloud) {
        deleteDotLocal(id);
        return;
      }
      const supabase = supabaseRef.current!;
      const { error } = await supabase.from("dots").delete().eq("id", id);
      if (error) console.error("[dots] delete error", error);
    },
  };
}

interface DotRow {
  id: string;
  owner_id: string;
  kind: Dot["kind"];
  occurred_on: string;
  title: string | null;
  body_md: string | null;
  refs: Dot["refs"] | null;
  logos_tag: Dot["logosTag"] | null;
  visibility: Dot["visibility"];
  livekit_room_name: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDot(row: unknown): Dot {
  const r = row as DotRow;
  return {
    id: r.id,
    ownerId: r.owner_id,
    kind: r.kind,
    occurredOn: r.occurred_on,
    title: r.title ?? undefined,
    bodyMd: r.body_md ?? undefined,
    refs: r.refs ?? [],
    logosTag: r.logos_tag ?? undefined,
    visibility: r.visibility,
    livekitRoomName: r.livekit_room_name ?? undefined,
    scheduledFor: r.scheduled_for ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
