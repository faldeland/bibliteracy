"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Dot, DotVisibility, LogosTag } from "@/lib/grid/types";
import type { DotUpdate } from "@/lib/grid/dotsApi";
import { formatRef, parseRefs } from "@/lib/bible/parseRef";
import { isoToLocalInput, localInputToISO } from "@/lib/grid/time";
import { TagsInput } from "./TagsInput";

interface DotEditorProps {
  dot: Dot;
  onCancel(): void;
  onSave(patch: DotUpdate): void;
  onDelete?(): void;
  /** Extra classes applied to the outer <form>. */
  className?: string;
}

export function DotEditor({
  dot,
  onCancel,
  onSave,
  onDelete,
  className,
}: DotEditorProps) {
  const [title, setTitle] = useState(dot.title ?? "");
  const [body, setBody] = useState(dot.bodyMd ?? "");
  const [refsText, setRefsText] = useState(
    dot.refs.map((r) => formatRef(r)).join("; "),
  );
  const [tags, setTags] = useState<string[]>(dot.tags ?? []);
  const [logosTag, setLogosTag] = useState<LogosTag>(dot.logosTag ?? "logos");
  const [visibility, setVisibility] = useState<DotVisibility>(dot.visibility);
  const [occurredOn, setOccurredOn] = useState(dot.occurredOn);
  // `createdAt` is the exact moment the dot was born. We expose it as
  // <input type="datetime-local"> which speaks local wall time, so the round
  // trip here converts ISO(UTC) → local and back.
  const [createdAtLocal, setCreatedAtLocal] = useState(() =>
    isoToLocalInput(dot.createdAt),
  );

  // If the underlying dot id changes, the parent re-mounts via key={dot.id}.
  // This effect just guards against weird in-place identity changes.
  useEffect(() => {
    setTitle(dot.title ?? "");
    setBody(dot.bodyMd ?? "");
    setRefsText(dot.refs.map((r) => formatRef(r)).join("; "));
    setTags(dot.tags ?? []);
    setLogosTag(dot.logosTag ?? "logos");
    setVisibility(dot.visibility);
    setOccurredOn(dot.occurredOn);
    setCreatedAtLocal(isoToLocalInput(dot.createdAt));
  }, [dot]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patch: DotUpdate = {
      title: title.trim() || undefined,
      bodyMd: body.trim() || undefined,
      refs: parseRefs(refsText),
      tags,
      visibility,
      occurredOn,
    };
    if (dot.kind === "logos") {
      patch.logosTag = logosTag;
    }
    // Only include createdAt in the patch if the user actually changed it,
    // so unrelated edits don't drift the server timestamp by ±1 minute due
    // to datetime-local rounding to the minute.
    const originalLocal = isoToLocalInput(dot.createdAt);
    if (createdAtLocal && createdAtLocal !== originalLocal) {
      patch.createdAt = localInputToISO(createdAtLocal);
    }
    onSave(patch);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-1 flex-col overflow-y-auto px-5 py-4",
        className,
      )}
    >
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Date
          </label>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Time created
          </label>
          <input
            type="datetime-local"
            value={createdAtLocal}
            onChange={(e) => setCreatedAtLocal(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
          />
        </div>
      </div>

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

      <label className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        Tags
      </label>
      <div className="mb-3">
        <TagsInput tags={tags} onChange={setTags} />
      </div>

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
