"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { isoToLocalInput, localInputToISO, toISO } from "@/lib/grid/time";
import { formatRef, parseSingleRef, refsEqual } from "@/lib/bible/parseRef";
import { useGridStore } from "@/lib/grid/state";
import { TagsInput } from "./TagsInput";
import type { BibleRef, DotVisibility, LogosTag } from "@/lib/grid/types";
import type { NewDotInput } from "@/lib/grid/dotsApi";
import type { Timeline } from "@/lib/grid/timelinesApi";

interface NewDotComposerProps {
  open: boolean;
  timeline: Timeline;
  date: Date;
  onClose(): void;
  onSubmit(dot: NewDotInput): void;
}

export function NewDotComposer({
  open,
  timeline,
  date,
  onClose,
  onSubmit,
}: NewDotComposerProps) {
  // Built-in timelines carry kind-specific behavior (logos_tag for Logos,
  // guest-visibility default for Discipleship, etc.). Custom timelines are
  // neutral — no logos_tag, no room, private by default.
  const kind = timeline.builtinKind ?? "logos";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [refs, setRefs] = useState<BibleRef[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [logosTag, setLogosTag] = useState<LogosTag>("logos");
  const [visibility, setVisibility] = useState<DotVisibility>(
    timeline.builtinKind === "discipleship" ? "guests" : "private",
  );
  // Default the moment to "the clicked day at the current time-of-day" — so
  // clicking today's cell lands on now, and clicking a past/future day keeps
  // the wall-clock minute but shifts the date. The user can override freely
  // via the <input type="datetime-local"> below.
  const [occurredAtLocal, setOccurredAtLocal] = useState(() =>
    defaultOccurredAtLocal(date),
  );

  // Snapshot the current Bible verse (whatever the reader is sitting on)
  // at the moment the composer opens. We pre-populate that as the first
  // tag so the most common case — "I'm reading X and want to add a dot
  // about it" — is one click away.
  const currentBibleRef = useGridStore((s) => s.currentBibleRef);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setRefs(currentBibleRef ? [currentBibleRef] : []);
    setTags([]);
    setLogosTag("logos");
    setVisibility(
      timeline.builtinKind === "discipleship" ? "guests" : "private",
    );
    setOccurredAtLocal(defaultOccurredAtLocal(date));
    // We deliberately snapshot `currentBibleRef` on open, not on every
    // change; once the composer is up, flipping the reader shouldn't
    // retroactively rewrite the user's tag choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, timeline.id]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Derive both the calendar day (`occurredOn`, drives lane X-bucket) and
    // the exact moment (`createdAt`, drives vertical time-of-day position)
    // from the single datetime-local field. If the user cleared the field,
    // fall back to the originally-clicked day and let the DB stamp now().
    const datePart = occurredAtLocal ? occurredAtLocal.slice(0, 10) : toISO(date);
    const createdAtIso = occurredAtLocal
      ? localInputToISO(occurredAtLocal)
      : undefined;
    onSubmit({
      kind,
      timelineId: timeline.id,
      occurredOn: datePart,
      title: title.trim() || undefined,
      bodyMd: body.trim() || undefined,
      refs,
      tags,
      logosTag: timeline.builtinKind === "logos" ? logosTag : undefined,
      visibility,
      createdAt: createdAtIso,
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
              New {timeline.name} dot
            </div>
            <label className="mt-1 block">
              <span className="sr-only">When</span>
              <input
                type="datetime-local"
                value={occurredAtLocal}
                onChange={(e) => setOccurredAtLocal(e.target.value)}
                className="rounded-lg border border-[var(--color-rule)] bg-white px-2 py-1 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink-2)]"
                aria-label="When"
              />
            </label>
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

        <RefTagsInput refs={refs} onChange={setRefs} />

        <div className="mb-3">
          <TagsInput tags={tags} onChange={setTags} />
        </div>

        {timeline.builtinKind === "logos" && (
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

// ─── Default-time helper ───────────────────────────────────────────────────
//
// Combine the clicked calendar day (from the lane button) with the *current*
// wall-clock time, then feed the result through `isoToLocalInput` so it's
// ready for an `<input type="datetime-local">` value. If the user clicked
// today, this just resolves to "right now"; for a different day they get
// "that day at the current minute" as a starting point to edit.
function defaultOccurredAtLocal(date: Date): string {
  const now = new Date();
  const d = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return isoToLocalInput(d.toISOString());
}

// ─── Tag-style reference input ─────────────────────────────────────────────
//
// Each Bible reference is a removable pill. Users add more by typing a
// ref (e.g. "Psa 23" or "Rom 8:28") and pressing Enter, comma, semicolon,
// or Tab; Backspace on an empty field pops the last pill. Invalid input
// is left in the text field and subtly flagged so the user can fix it
// instead of silently losing what they typed.

function RefTagsInput({
  refs,
  onChange,
}: {
  refs: BibleRef[];
  onChange(next: BibleRef[]): void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const draftIsValid = useMemo(() => {
    if (!draft.trim()) return true;
    return parseSingleRef(draft) !== null;
  }, [draft]);

  function commit(raw: string): "ok" | "empty" | "invalid" {
    const trimmed = raw.trim();
    if (!trimmed) return "empty";
    const parsed = parseSingleRef(trimmed);
    if (!parsed) return "invalid";
    if (refs.some((r) => refsEqual(r, parsed))) {
      // Already tagged — treat as a no-op success so the input clears.
      return "ok";
    }
    onChange([...refs, parsed]);
    return "ok";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      if (!draft.trim()) {
        // Let Tab fall through so users can keyboard-navigate out of the field.
        return;
      }
      const result = commit(draft);
      if (result === "invalid") {
        e.preventDefault();
        setError(`Not a valid Bible reference: "${draft.trim()}"`);
        return;
      }
      e.preventDefault();
      setDraft("");
      setError(null);
    } else if (e.key === "Backspace" && !draft && refs.length > 0) {
      e.preventDefault();
      onChange(refs.slice(0, -1));
    }
  }

  function handleBlur() {
    if (!draft.trim()) return;
    const result = commit(draft);
    if (result === "ok") {
      setDraft("");
      setError(null);
    } else if (result === "invalid") {
      setError(`Not a valid Bible reference: "${draft.trim()}"`);
    }
  }

  function removeAt(index: number) {
    onChange(refs.filter((_, i) => i !== index));
  }

  return (
    <div className="mb-3">
      <div
        className={cn(
          "flex w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-sm outline-none focus-within:border-[var(--color-ink-2)]",
          error ? "border-red-500" : "border-[var(--color-rule)]",
        )}
        onClick={(e) => {
          // Clicking empty chrome should focus the text field, but clicks on
          // a tag's remove-× must not bubble up and re-focus us.
          const target = e.target as HTMLElement;
          if (target.closest("[data-ref-tag]")) return;
          const input = e.currentTarget.querySelector("input");
          input?.focus();
        }}
      >
        {refs.map((r, i) => (
          <RefTag
            key={`${r.book}-${r.chapter}-${r.verseStart ?? ""}-${r.verseEnd ?? ""}-${i}`}
            label={formatRef(r)}
            onRemove={() => removeAt(i)}
          />
        ))}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={
            refs.length === 0
              ? "Bible references (e.g. John 3:16-17, Psa 23)"
              : "Add another…"
          }
          aria-invalid={!draftIsValid}
          aria-label="Add Bible reference"
          className={cn(
            "min-w-[10rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-[var(--color-ink-2)]/60",
            !draftIsValid && "text-red-700",
          )}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function RefTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove(): void;
}) {
  return (
    <span
      data-ref-tag
      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)]/70 py-0.5 pl-2 pr-0.5 text-xs text-[var(--color-ink)]"
    >
      <span className="font-serif">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-ink-2)] hover:bg-black/10 hover:text-[var(--color-ink)]"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-3 w-3"
          aria-hidden
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </span>
  );
}
