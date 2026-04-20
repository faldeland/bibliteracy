"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Dot } from "./types";

export type DotUpdate = Partial<
  Omit<Dot, "id" | "ownerId" | "createdAt" | "updatedAt">
>;

export type NewDotInput = Omit<
  Dot,
  "id" | "ownerId" | "createdAt" | "updatedAt"
>;

export interface DotsApi {
  dots: Dot[];
  isLoading: boolean;
  /** Always true now that the grid is gated behind sign-in — kept for UI code. */
  isCloud: boolean;
  userId: string;
  createDot(partial: NewDotInput): Promise<void>;
  updateDot(id: string, patch: DotUpdate): Promise<void>;
  deleteDot(id: string): Promise<void>;
}

export function dotsQueryKey(userId: string): QueryKey {
  return ["dots", userId];
}

/**
 * Fetches + subscribes to the current user's dots. Strictly scoped to
 * `owner_id = userId` at the query layer (RLS is a belt-and-suspenders);
 * realtime payloads are filtered server-side by the same predicate.
 *
 * Mutations are optimistic: the cache is patched immediately and rolled back
 * on error, then reconciled when the realtime INSERT/UPDATE/DELETE echoes
 * back from Postgres.
 */
export function useDots(userId: string): DotsApi {
  const queryClient = useQueryClient();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const queryKey = useMemo(() => dotsQueryKey(userId), [userId]);

  const { data, isLoading } = useQuery<Dot[]>({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dots")
        .select("*")
        .eq("owner_id", userId)
        .order("occurred_on", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(rowToDot);
    },
  });

  // Realtime: apply server echoes into the cached list.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dots-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dots",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.setQueryData<Dot[]>(queryKey, (prev) => {
            if (!prev) return prev;
            if (payload.eventType === "INSERT") {
              const next = rowToDot(payload.new);
              if (prev.some((d) => d.id === next.id)) return prev;
              return [...prev, next];
            }
            if (payload.eventType === "UPDATE") {
              const next = rowToDot(payload.new);
              return prev.map((d) => (d.id === next.id ? next : d));
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
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, userId, queryKey]);

  const createMut = useMutation({
    mutationFn: async (partial: NewDotInput) => {
      const { data, error } = await supabase
        .from("dots")
        .insert({
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
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToDot(data);
    },
    onMutate: async (partial) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Dot[]>(queryKey) ?? [];
      const now = new Date().toISOString();
      const optimistic: Dot = {
        ...partial,
        id: `optimistic-${now}-${Math.random().toString(36).slice(2, 8)}`,
        ownerId: userId,
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData<Dot[]>(queryKey, [...previous, optimistic]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_err, _partial, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSuccess: (saved, _partial, ctx) => {
      queryClient.setQueryData<Dot[]>(queryKey, (prev) => {
        const list = prev ?? [];
        const withoutOpt = ctx
          ? list.filter((d) => d.id !== ctx.optimisticId)
          : list;
        if (withoutOpt.some((d) => d.id === saved.id)) return withoutOpt;
        return [...withoutOpt, saved];
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: DotUpdate }) => {
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
      const { error } = await supabase
        .from("dots")
        .update(row)
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Dot[]>(queryKey) ?? [];
      queryClient.setQueryData<Dot[]>(queryKey, (prev) =>
        (prev ?? []).map((d) =>
          d.id === id
            ? { ...d, ...patch, updatedAt: new Date().toISOString() }
            : d,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dots")
        .delete()
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Dot[]>(queryKey) ?? [];
      queryClient.setQueryData<Dot[]>(queryKey, (prev) =>
        (prev ?? []).filter((d) => d.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  return {
    dots: data ?? [],
    isLoading,
    isCloud: true,
    userId,
    async createDot(partial) {
      await createMut.mutateAsync(partial);
    },
    async updateDot(id, patch) {
      await updateMut.mutateAsync({ id, patch });
    },
    async deleteDot(id) {
      await deleteMut.mutateAsync(id);
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

export function rowToDot(row: unknown): Dot {
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
