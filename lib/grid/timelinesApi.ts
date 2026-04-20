"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DotKind } from "./types";

export type TimelineHeightPreset = "compact" | "normal" | "tall";

/**
 * A user-defined lane on the grid. Built-in timelines have
 * `builtinKind ∈ {'logos','prayer','discipleship'}` and are auto-seeded at
 * signup (see `handle_new_user` trigger). Custom timelines have
 * `builtinKind = null` and a user-chosen name.
 *
 * Appearance fields (`color`, `heightPreset`, `showDayCells`,
 * `showTodayHighlight`, `gridSubdivisions`, `verticalAnchor`) are editable
 * per-lane via the timeline settings sheet. `color === null` means
 * "fall back to the client-side default" (built-in CSS var for built-ins,
 * or a palette entry for custom lanes).
 */
export interface Timeline {
  id: string;
  ownerId: string;
  name: string;
  sortOrder: number;
  builtinKind: DotKind | null;
  color: string | null;
  heightPreset: TimelineHeightPreset;
  showDayCells: boolean;
  showTodayHighlight: boolean;
  /** 0..8. 0 = no horizontal guides, 1 = midline, 2 = thirds, etc. */
  gridSubdivisions: number;
  /** 0..1, top-to-bottom. 0.5 reproduces the pre-settings behavior. */
  verticalAnchor: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineUpdate {
  name?: string;
  sortOrder?: number;
  color?: string | null;
  heightPreset?: TimelineHeightPreset;
  showDayCells?: boolean;
  showTodayHighlight?: boolean;
  gridSubdivisions?: number;
  verticalAnchor?: number;
}

export interface NewTimelineInput {
  name: string;
  /** Optional — if omitted, placed at the end. */
  sortOrder?: number;
}

export interface TimelinesApi {
  timelines: Timeline[];
  isLoading: boolean;
  createTimeline(input: NewTimelineInput): Promise<Timeline>;
  updateTimeline(id: string, patch: TimelineUpdate): Promise<void>;
  deleteTimeline(id: string): Promise<void>;
  /**
   * Reorder by moving `id` into position `toIndex` within the current ordered
   * list. Uses midpoint math on `sort_order` so only the moved row is written.
   */
  moveTimeline(id: string, toIndex: number): Promise<void>;
}

export function timelinesQueryKey(userId: string): QueryKey {
  return ["timelines", userId];
}

/**
 * The three lanes the product ships with. The DB `handle_new_user` trigger
 * seeds these on signup; we also self-heal on the client (see `useTimelines`)
 * so users that pre-date the migration still see the full grid.
 */
const BUILTIN_SEEDS: ReadonlyArray<{
  name: string;
  sort_order: number;
  builtin_kind: DotKind;
}> = [
  { name: "Logos + Rhema", sort_order: 0, builtin_kind: "logos" },
  { name: "Prayer", sort_order: 1, builtin_kind: "prayer" },
  { name: "Discipleship", sort_order: 2, builtin_kind: "discipleship" },
];

export function useTimelines(userId: string): TimelinesApi {
  const queryClient = useQueryClient();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const queryKey = useMemo(() => timelinesQueryKey(userId), [userId]);

  const { data, isLoading } = useQuery<Timeline[]>({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timelines")
        .select("*")
        .eq("owner_id", userId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []).map(rowToTimeline);
      // Self-heal: if the current user has no built-in timelines yet (e.g.
      // signed up before the timelines migration, or the DB-side backfill
      // never ran), insert them now so the grid is never empty. The partial
      // unique (owner_id, builtin_kind) index keeps this idempotent across
      // concurrent tabs.
      const missing = BUILTIN_SEEDS.filter(
        (s) => !rows.some((r) => r.builtinKind === s.builtin_kind),
      );
      if (missing.length === 0) return rows;
      const { data: inserted, error: insErr } = await supabase
        .from("timelines")
        .upsert(
          missing.map((s) => ({
            owner_id: userId,
            name: s.name,
            sort_order: s.sort_order,
            builtin_kind: s.builtin_kind,
          })),
          { onConflict: "owner_id,builtin_kind", ignoreDuplicates: true },
        )
        .select("*");
      if (insErr) throw insErr;
      const seeded = [...rows, ...(inserted ?? []).map(rowToTimeline)];
      return sortBySortOrder(seeded);
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`timelines-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timelines",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.setQueryData<Timeline[]>(queryKey, (prev) => {
            if (!prev) return prev;
            if (payload.eventType === "INSERT") {
              const next = rowToTimeline(payload.new);
              if (prev.some((t) => t.id === next.id)) return prev;
              return sortBySortOrder([...prev, next]);
            }
            if (payload.eventType === "UPDATE") {
              const next = rowToTimeline(payload.new);
              return sortBySortOrder(
                prev.map((t) => (t.id === next.id ? next : t)),
              );
            }
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return prev.filter((t) => t.id !== id);
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
    mutationFn: async (input: NewTimelineInput): Promise<Timeline> => {
      const current = queryClient.getQueryData<Timeline[]>(queryKey) ?? [];
      const sortOrder =
        input.sortOrder ??
        (current.length
          ? Math.max(...current.map((t) => t.sortOrder)) + 1
          : 0);
      const { data, error } = await supabase
        .from("timelines")
        .insert({
          owner_id: userId,
          name: input.name.trim(),
          sort_order: sortOrder,
          builtin_kind: null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToTimeline(data);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Timeline[]>(queryKey, (prev) => {
        const list = prev ?? [];
        if (list.some((t) => t.id === saved.id)) return list;
        return sortBySortOrder([...list, saved]);
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: TimelineUpdate;
    }) => {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
      if (patch.color !== undefined) row.color = patch.color;
      if (patch.heightPreset !== undefined) row.height_preset = patch.heightPreset;
      if (patch.showDayCells !== undefined) row.show_day_cells = patch.showDayCells;
      if (patch.showTodayHighlight !== undefined)
        row.show_today_highlight = patch.showTodayHighlight;
      if (patch.gridSubdivisions !== undefined)
        row.grid_subdivisions = clampSubdivisions(patch.gridSubdivisions);
      if (patch.verticalAnchor !== undefined)
        row.vertical_anchor = clampAnchor(patch.verticalAnchor);
      const { error } = await supabase
        .from("timelines")
        .update(row)
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Timeline[]>(queryKey) ?? [];
      queryClient.setQueryData<Timeline[]>(queryKey, (prev) => {
        const next = (prev ?? []).map((t) =>
          t.id === id
            ? {
                ...t,
                ...(patch.name !== undefined ? { name: patch.name } : {}),
                ...(patch.sortOrder !== undefined
                  ? { sortOrder: patch.sortOrder }
                  : {}),
                ...(patch.color !== undefined ? { color: patch.color } : {}),
                ...(patch.heightPreset !== undefined
                  ? { heightPreset: patch.heightPreset }
                  : {}),
                ...(patch.showDayCells !== undefined
                  ? { showDayCells: patch.showDayCells }
                  : {}),
                ...(patch.showTodayHighlight !== undefined
                  ? { showTodayHighlight: patch.showTodayHighlight }
                  : {}),
                ...(patch.gridSubdivisions !== undefined
                  ? { gridSubdivisions: clampSubdivisions(patch.gridSubdivisions) }
                  : {}),
                ...(patch.verticalAnchor !== undefined
                  ? { verticalAnchor: clampAnchor(patch.verticalAnchor) }
                  : {}),
                updatedAt: new Date().toISOString(),
              }
            : t,
        );
        return sortBySortOrder(next);
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
      // Surface the failure so an e.g. missing-column or RLS error doesn't
      // silently manifest as "the UI snaps back to the old value" (which is
      // what the optimistic rollback would otherwise look like to the user).
      // eslint-disable-next-line no-console
      console.error("[timelines] update failed:", err);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("timelines")
        .delete()
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Timeline[]>(queryKey) ?? [];
      queryClient.setQueryData<Timeline[]>(queryKey, (prev) =>
        (prev ?? []).filter((t) => t.id !== id),
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx) queryClient.setQueryData(queryKey, ctx.previous);
      // eslint-disable-next-line no-console
      console.error("[timelines] delete failed:", err);
    },
  });

  return {
    timelines: data ?? [],
    isLoading,
    async createTimeline(input) {
      return await createMut.mutateAsync(input);
    },
    async updateTimeline(id, patch) {
      await updateMut.mutateAsync({ id, patch });
    },
    async deleteTimeline(id) {
      await deleteMut.mutateAsync(id);
    },
    async moveTimeline(id, toIndex) {
      const list = queryClient.getQueryData<Timeline[]>(queryKey) ?? [];
      const newOrder = computeSortOrderForMove(list, id, toIndex);
      if (newOrder === null) return;
      await updateMut.mutateAsync({ id, patch: { sortOrder: newOrder } });
    },
  };
}

/**
 * Pure helper — given an ordered list of timelines, the id of the one being
 * moved, and its target index in the new ordering, return the `sort_order`
 * value to persist on the moved row (midpoint between new neighbours). Returns
 * `null` when the move is a no-op (same position) or the id isn't in the list.
 *
 * Exposed (non-hook) so tests can exercise the reorder math without Supabase.
 */
export function computeSortOrderForMove(
  list: Timeline[],
  id: string,
  toIndex: number,
): number | null {
  const fromIndex = list.findIndex((t) => t.id === id);
  if (fromIndex === -1) return null;
  // Drop the moved item, then splice into the new index.
  const without = list.filter((t) => t.id !== id);
  const clampedTo = Math.max(0, Math.min(toIndex, without.length));
  if (clampedTo === fromIndex) return null;
  const before = without[clampedTo - 1];
  const after = without[clampedTo];
  if (!before && !after) return 0;
  if (!before && after) return after.sortOrder - 1;
  if (before && !after) return before.sortOrder + 1;
  // Midpoint between neighbours keeps the list strictly ordered without a
  // full renumber. Floating-point precision lets this repeat for any
  // realistic number of reorders.
  return (before!.sortOrder + after!.sortOrder) / 2;
}

function sortBySortOrder(list: Timeline[]): Timeline[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
}

interface TimelineRow {
  id: string;
  owner_id: string;
  name: string;
  sort_order: number;
  builtin_kind: DotKind | null;
  color: string | null;
  height_preset: TimelineHeightPreset | null;
  show_day_cells: boolean | null;
  show_today_highlight: boolean | null;
  grid_subdivisions: number | null;
  vertical_anchor: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Defaults applied when a row is missing an appearance field (e.g. a row
 * written before the timeline_appearance migration landed or on a local
 * Supabase instance that hasn't been re-migrated). Keeping them here — not
 * just as DB defaults — means the UI still renders sensibly in tests and in
 * the face of stale caches.
 */
export const TIMELINE_APPEARANCE_DEFAULTS = {
  color: null as string | null,
  heightPreset: "normal" as TimelineHeightPreset,
  showDayCells: true,
  showTodayHighlight: true,
  gridSubdivisions: 1,
  verticalAnchor: 0.5,
} as const;

export function rowToTimeline(row: unknown): Timeline {
  const r = row as TimelineRow;
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    sortOrder: Number(r.sort_order),
    builtinKind: r.builtin_kind ?? null,
    color: r.color ?? TIMELINE_APPEARANCE_DEFAULTS.color,
    heightPreset:
      (r.height_preset as TimelineHeightPreset | null) ??
      TIMELINE_APPEARANCE_DEFAULTS.heightPreset,
    showDayCells:
      r.show_day_cells ?? TIMELINE_APPEARANCE_DEFAULTS.showDayCells,
    showTodayHighlight:
      r.show_today_highlight ?? TIMELINE_APPEARANCE_DEFAULTS.showTodayHighlight,
    gridSubdivisions: clampSubdivisions(
      r.grid_subdivisions ?? TIMELINE_APPEARANCE_DEFAULTS.gridSubdivisions,
    ),
    verticalAnchor: clampAnchor(
      r.vertical_anchor ?? TIMELINE_APPEARANCE_DEFAULTS.verticalAnchor,
    ),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function clampSubdivisions(n: number): number {
  if (!Number.isFinite(n)) return TIMELINE_APPEARANCE_DEFAULTS.gridSubdivisions;
  return Math.max(0, Math.min(8, Math.round(n)));
}

export function clampAnchor(n: number): number {
  if (!Number.isFinite(n)) return TIMELINE_APPEARANCE_DEFAULTS.verticalAnchor;
  return Math.max(0, Math.min(1, n));
}

/** Exact pixel row-height for each preset. */
export const TIMELINE_HEIGHT_PX: Record<TimelineHeightPreset, number> = {
  compact: 30,
  normal: 42,
  tall: 72,
};
