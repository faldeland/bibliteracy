"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Dot, DotVisibility, LogosTag } from "@/lib/grid/types";
import type { DotUpdate } from "@/lib/grid/dotsApi";
import { formatRef, parseRefs } from "@/lib/bible/parseRef";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { RoomEmbed } from "@/components/live/RoomEmbed";

interface DotSheetProps {
  dot: Dot | null;
  onClose(): void;
  onUpdate?(id: string, patch: DotUpdate): void;
  onDelete?(id: string): void;
}

export function DotSheet({ dot, onClose, onUpdate, onDelete }: DotSheetProps) {
  const open = !!dot;
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md bg-[var(--color-paper)] shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {dot && (
          <DotDetail
            // Re-mount when the active dot changes so local edit state resets cleanly.
            key={dot.id}
            dot={dot}
            onClose={onClose}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        )}
      </aside>
    </>
  );
}

function DotDetail({
  dot,
  onClose,
  onUpdate,
  onDelete,
}: {
  dot: Dot;
  onClose(): void;
  onUpdate?(id: string, patch: DotUpdate): void;
  onDelete?(id: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = !!onUpdate;
  const canDelete = !!onDelete;

  return (
    <div className="flex h-full flex-col">
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
            {dot.occurredOn}
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

function DotEditor({
  dot,
  onCancel,
  onSave,
  onDelete,
}: {
  dot: Dot;
  onCancel(): void;
  onSave(patch: DotUpdate): void;
  onDelete?(): void;
}) {
  const [title, setTitle] = useState(dot.title ?? "");
  const [body, setBody] = useState(dot.bodyMd ?? "");
  const [refsText, setRefsText] = useState(
    dot.refs.map((r) => formatRef(r)).join("; "),
  );
  const [logosTag, setLogosTag] = useState<LogosTag>(dot.logosTag ?? "logos");
  const [visibility, setVisibility] = useState<DotVisibility>(dot.visibility);
  const [occurredOn, setOccurredOn] = useState(dot.occurredOn);

  // If the underlying dot id changes, the parent re-mounts via key={dot.id}.
  // This effect just guards against weird in-place identity changes.
  useEffect(() => {
    setTitle(dot.title ?? "");
    setBody(dot.bodyMd ?? "");
    setRefsText(dot.refs.map((r) => formatRef(r)).join("; "));
    setLogosTag(dot.logosTag ?? "logos");
    setVisibility(dot.visibility);
    setOccurredOn(dot.occurredOn);
  }, [dot]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patch: DotUpdate = {
      title: title.trim() || undefined,
      bodyMd: body.trim() || undefined,
      refs: parseRefs(refsText),
      visibility,
      occurredOn,
    };
    if (dot.kind === "logos") {
      patch.logosTag = logosTag;
    }
    onSave(patch);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-1 flex-col overflow-y-auto px-5 py-4"
    >
      <label className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        Date
      </label>
      <input
        type="date"
        value={occurredOn}
        onChange={(e) => setOccurredOn(e.target.value)}
        className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
      />

      <label className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        Title
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 font-serif text-lg outline-none focus:border-[var(--color-ink-2)]"
      />

      <label className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        Notes
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Notes (markdown)"
        rows={6}
        className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
      />

      <label className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        References
      </label>
      <input
        value={refsText}
        onChange={(e) => setRefsText(e.target.value)}
        placeholder="John 3:16-17; Psa 23"
        className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
      />

      {dot.kind === "logos" && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Logos tag
          </div>
          <div className="flex gap-2">
            {(["logos", "rhema", "both"] as LogosTag[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLogosTag(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest",
                  logosTag === t
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-black/5",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
          Visibility
        </div>
        <div className="flex gap-2">
          {(["private", "guests", "public"] as DotVisibility[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest",
                visibility === v
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-black/5",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--color-rule)] pt-4">
        <div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-paper)] hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </form>
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
