"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Dot } from "@/lib/grid/types";
import type { DotUpdate } from "@/lib/grid/dotsApi";
import { formatRef } from "@/lib/bible/parseRef";
import { formatLocalTime } from "@/lib/grid/time";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { RoomEmbed } from "@/components/live/RoomEmbed";
import { DotEditor } from "./DotEditor";
import { FloatingDotEditor } from "./FloatingDotEditor";

interface DotSheetProps {
  dot: Dot | null;
  /**
   * All dots sharing the active dot's lane + day, newest first. When more
   * than one is present the panel shows prev/next navigation so each can be
   * viewed and edited.
   */
  siblings?: Dot[];
  onSelectSibling?(id: string): void;
  onClose(): void;
  onUpdate?(id: string, patch: DotUpdate): void;
  onDelete?(id: string): void;
}

export function DotSheet({
  dot,
  siblings,
  onSelectSibling,
  onClose,
  onUpdate,
  onDelete,
}: DotSheetProps) {
  const open = !!dot;
  // When `detached` is true, the editor is floating in its own popup and the
  // side-panel shell hides (slides off-screen) so the user can see the grid
  // underneath. Detach state lives here (not in DotDetail) so it survives
  // switching between sibling dots inside the popup.
  const [detached, setDetached] = useState(false);
  // Clear detach state when the sheet closes entirely (no active dot).
  useEffect(() => {
    if (!open) setDetached(false);
  }, [open]);

  // Dismiss on Escape. Without a backdrop to click, Escape becomes the
  // primary "close" gesture for keyboard users. We intentionally DO NOT
  // trap focus or render a modal overlay so the rest of the app — the
  // timeline grid, search bar, version picker, book strip — stays fully
  // interactive while the user edits a dot.
  useEffect(() => {
    if (!open) return;
    // Let the popup own the Escape key when it's mounted; otherwise two
    // listeners would both fire and close the whole sheet unexpectedly.
    if (detached) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, detached, onClose]);

  const hidden = !open || detached;

  return (
    <>
      <aside
        // Non-modal: no backdrop, so pointer events on the rest of the page
        // keep flowing through. When the sheet is closed or detached it
        // slides off-screen and its pointer events are disabled so it can't
        // intercept clicks.
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--color-rule)] bg-[var(--color-paper)] transition-transform",
          hidden
            ? "pointer-events-none translate-x-full"
            : "translate-x-0 shadow-2xl",
        )}
        aria-hidden={hidden}
        aria-label="Dot details"
      >
        {dot && (
          <DotDetail
            // Re-mount when the active dot changes so local edit state resets cleanly.
            key={dot.id}
            dot={dot}
            siblings={siblings ?? [dot]}
            onSelectSibling={onSelectSibling}
            onClose={onClose}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDetach={onUpdate ? () => setDetached(true) : undefined}
          />
        )}
      </aside>
      {dot && detached && onUpdate && (
        <FloatingDotEditor
          dot={dot}
          onClose={() => setDetached(false)}
          onReattach={() => setDetached(false)}
          onSave={(patch) => {
            onUpdate(dot.id, patch);
            setDetached(false);
          }}
          onDelete={
            onDelete
              ? () => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm("Delete this dot? This can't be undone.")
                  ) {
                    return;
                  }
                  onDelete(dot.id);
                  setDetached(false);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function DotDetail({
  dot,
  siblings,
  onSelectSibling,
  onClose,
  onUpdate,
  onDelete,
  onDetach,
}: {
  dot: Dot;
  siblings: Dot[];
  onSelectSibling?(id: string): void;
  onClose(): void;
  onUpdate?(id: string, patch: DotUpdate): void;
  onDelete?(id: string): void;
  onDetach?(): void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = !!onUpdate;
  const canDelete = !!onDelete;

  const index = siblings.findIndex((s) => s.id === dot.id);
  const hasGroup = siblings.length > 1 && index >= 0 && !!onSelectSibling;
  const goPrev = () => {
    if (!hasGroup) return;
    const prev = siblings[index - 1] ?? siblings[siblings.length - 1];
    onSelectSibling!(prev.id);
  };
  const goNext = () => {
    if (!hasGroup) return;
    const next = siblings[index + 1] ?? siblings[0];
    onSelectSibling!(next.id);
  };

  return (
    <div className="flex h-full flex-col">
      {hasGroup && (
        <DaySiblingNav
          siblings={siblings}
          activeId={dot.id}
          index={index}
          onSelect={onSelectSibling!}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
      <header className="flex items-start justify-between border-b border-[var(--color-rule)] px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            {dot.kind}
            {dot.logosTag ? ` · ${dot.logosTag}` : ""}
          </div>
          <h2 className="mt-1 font-serif text-xl text-[var(--color-ink)]">
            {dot.title || "Untitled"}
          </h2>
          <div className="mt-0.5 text-xs text-[var(--color-ink-2)]">
            {dot.occurredOn} · {formatLocalTime(dot.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full px-3 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
            >
              Edit
            </button>
          )}
          {canEdit && editing && onDetach && (
            <button
              type="button"
              onClick={onDetach}
              title="Pop out into a floating editor"
              className="rounded-full px-3 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
            >
              Detach
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
          >
            Close
          </button>
        </div>
      </header>

      {editing && onUpdate ? (
        <DotEditor
          dot={dot}
          onCancel={() => setEditing(false)}
          onSave={(patch) => {
            onUpdate(dot.id, patch);
            setEditing(false);
          }}
          onDelete={
            canDelete
              ? () => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm("Delete this dot? This can't be undone.")
                  ) {
                    return;
                  }
                  onDelete!(dot.id);
                }
              : undefined
          }
        />
      ) : (
        <DotReadView dot={dot} />
      )}
    </div>
  );
}

function DaySiblingNav({
  siblings,
  activeId,
  index,
  onSelect,
  onPrev,
  onNext,
}: {
  siblings: Dot[];
  activeId: string;
  index: number;
  onSelect(id: string): void;
  onPrev(): void;
  onNext(): void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 px-3 py-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous dot on this day"
        className="rounded-md px-2 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
      >
        ←
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
          {index + 1} / {siblings.length}
        </span>
        <div className="mx-2 h-4 w-px bg-[var(--color-rule)]" />
        <div className="flex min-w-0 items-center gap-1">
          {siblings.map((s, i) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                title={s.title || "(untitled)"}
                className={cn(
                  "max-w-[12ch] shrink-0 truncate rounded-full border px-2.5 py-0.5 text-[11px]",
                  isActive
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-black/5",
                )}
              >
                {s.title?.trim() || `#${i + 1}`}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next dot on this day"
        className="rounded-md px-2 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
      >
        →
      </button>
    </div>
  );
}

function DotReadView({ dot }: { dot: Dot }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-[var(--color-ink)]">
      {dot.bodyMd ? (
        <p className="whitespace-pre-wrap">{dot.bodyMd}</p>
      ) : (
        <p className="italic text-[var(--color-ink-2)]">No notes yet.</p>
      )}

      {dot.refs.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            References
          </div>
          <ul className="space-y-1 text-sm">
            {dot.refs.map((r, i) => (
              <li key={i} className="text-[var(--color-ink-2)]">
                {formatRef(r)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dot.tags.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Tags
          </div>
          <ul className="flex flex-wrap gap-1.5 text-sm">
            {dot.tags.map((t) => (
              <li
                key={t}
                className="rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)]/70 px-2 py-0.5 text-xs text-[var(--color-ink)]"
              >
                #{t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dot.attachments && dot.attachments.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Attachments
          </div>
          <ul className="space-y-1 text-sm">
            {dot.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-prayer)] underline"
                >
                  {a.kind}: {a.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dot.kind === "discipleship" && <DiscipleshipLiveBlock dot={dot} />}
    </div>
  );
}

function DiscipleshipLiveBlock({ dot }: { dot: Dot }) {
  const [roomName, setRoomName] = useState<string | null>(
    dot.livekitRoomName ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Live rooms require Supabase + LiveKit to be configured.
      </div>
    );
  }

  async function ensureRoom() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dotId: dot.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    const { roomName: rn } = (await res.json()) as { roomName: string };
    setRoomName(rn);
    setOpen(true);
  }

  return (
    <>
      <div className="mt-6 rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper-2)]/50 p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
          Live room
        </div>
        {roomName && (
          <div className="mt-1 font-mono text-xs text-[var(--color-ink-2)]">
            {roomName}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => (roomName ? setOpen(true) : ensureRoom())}
            disabled={busy}
            className="rounded-md bg-[var(--color-discipleship)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Preparing…" : roomName ? "Open live room" : "Start live room"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>

      {open && roomName && (
        <div className="fixed inset-0 z-[60] bg-black">
          <div className="absolute right-3 top-3 z-10">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            >
              Close
            </button>
          </div>
          <RoomEmbed roomName={roomName} />
        </div>
      )}
    </>
  );
}
