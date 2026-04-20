"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toISO } from "@/lib/grid/time";
import { parseRefs } from "@/lib/bible/parseRef";
import type { Dot, DotKind, DotVisibility, LogosTag } from "@/lib/grid/types";

interface NewDotComposerProps {
  open: boolean;
  kind: DotKind;
  date: Date;
  onClose(): void;
  onSubmit(dot: Omit<Dot, "id" | "ownerId" | "createdAt" | "updatedAt">): void;
}

export function NewDotComposer({
  open,
  kind,
  date,
  onClose,
  onSubmit,
}: NewDotComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [refsText, setRefsText] = useState("");
  const [logosTag, setLogosTag] = useState<LogosTag>("logos");
  const [visibility, setVisibility] = useState<DotVisibility>(
    kind === "discipleship" ? "guests" : "private",
  );

  useEffect(() => {
    if (open) {
      setTitle("");
      setBody("");
      setRefsText("");
      setLogosTag("logos");
      setVisibility(kind === "discipleship" ? "guests" : "private");
    }
  }, [open, kind]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      kind,
      occurredOn: toISO(date),
      title: title.trim() || undefined,
      bodyMd: body.trim() || undefined,
      refs: parseRefs(refsText),
      logosTag: kind === "logos" ? logosTag : undefined,
      visibility,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-24">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
              New {kind} dot
            </div>
            <div className="text-sm text-[var(--color-ink-2)]">
              {toISO(date)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
          >
            Cancel
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 font-serif text-lg outline-none focus:border-[var(--color-ink-2)]"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Notes (markdown)"
          rows={5}
          className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
        />

        <input
          value={refsText}
          onChange={(e) => setRefsText(e.target.value)}
          placeholder="Bible references (e.g. John 3:16-17, Psa 23)"
          className="mb-3 w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
        />

        {kind === "logos" && (
          <div className="mb-3 flex gap-2">
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
        )}

        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Visibility
          </span>
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

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-paper)] hover:opacity-90"
          >
            Save dot
          </button>
        </div>
      </form>
    </div>
  );
}

