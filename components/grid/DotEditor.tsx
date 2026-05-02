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
  /**
   * Tightens padding, type sizes, and stretches the notes textarea to fill
   * any remaining vertical space — used inside the floating popup so the
   * user maximizes the surface they're actually writing into while still
   * seeing every metadata field at a glance.
   */
  compact?: boolean;
}

export function DotEditor({
  dot,
  onCancel,
  onSave,
  onDelete,
  className,
  compact = false,
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

  const labelClass = compact
    ? "block text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-2)]/80"
    : "block text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]";
  const labelGap = compact ? "mb-0" : "mb-1";
  const inputClass = compact
    ? "w-full rounded border border-[var(--color-rule)] bg-white px-1.5 py-0.5 text-[11px] leading-tight outline-none focus:border-[var(--color-ink-2)]"
    : "w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]";
  const titleInputClass = compact
    ? "w-full rounded border border-[var(--color-rule)] bg-white px-1.5 py-0.5 font-serif text-[13px] leading-tight outline-none focus:border-[var(--color-ink-2)]"
    : "w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 font-serif text-lg outline-none focus:border-[var(--color-ink-2)]";
  const pillClass = compact
    ? "rounded-full border px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.08em]"
    : "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest";
  const fieldGap = compact ? "mb-1" : "mb-3";
  const sectionGap = compact ? "mb-1" : "mb-4";
  const footerBtn = compact ? "px-1.5 py-0.5 text-[11px]" : "px-3 py-2 text-sm";
  const saveBtn = compact ? "px-2 py-0.5 text-[11px]" : "px-4 py-2 text-sm";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        // In compact mode the form itself doesn't scroll — the notes
        // textarea takes the remaining vertical space instead. That way
        // a tiny popup becomes "mostly notes" instead of "mostly chrome".
        compact
          ? "flex min-h-0 flex-1 flex-col px-2 py-1.5"
          : "flex flex-1 flex-col overflow-y-auto px-5 py-4",
        className,
      )}
    >
      {compact ? (
        <div className={cn("grid grid-cols-[1fr_1fr_1fr] gap-1.5", fieldGap)}>
          <input
            type="date"
            aria-label="Date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className={inputClass}
          />
          <input
            type="datetime-local"
            aria-label="Time created"
            value={createdAtLocal}
            onChange={(e) => setCreatedAtLocal(e.target.value)}
            className={cn(inputClass, "col-span-2")}
          />
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-2", fieldGap)}>
          <div>
            <label className={cn(labelClass, labelGap)}>Date</label>
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={cn(labelClass, labelGap)}>Time created</label>
            <input
              type="datetime-local"
              value={createdAtLocal}
              onChange={(e) => setCreatedAtLocal(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {!compact && (
        <label className={cn(labelClass, labelGap)}>Title</label>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        aria-label="Title"
        className={cn(fieldGap, titleInputClass)}
      />

      {/* Notes — the whole point of the editor. In compact mode this wraps
          in a flex-1 column so the textarea grows to fill every pixel the
          other fields don't need. */}
      <div
        className={cn(
          compact ? "flex min-h-0 flex-1 flex-col" : "flex flex-col",
          fieldGap,
        )}
      >
        {!compact && (
          <label className={cn(labelClass, labelGap)}>Notes</label>
        )}
        {compact ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notes (markdown)"
            aria-label="Notes"
            className="min-h-0 w-full flex-1 resize-none rounded border border-[var(--color-rule)] bg-white px-1.5 py-1 text-[12px] leading-snug outline-none focus:border-[var(--color-ink-2)]"
          />
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notes (markdown)"
            rows={6}
            className="w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
          />
        )}
      </div>

      {compact ? (
        <input
          value={refsText}
          onChange={(e) => setRefsText(e.target.value)}
          placeholder="Refs: John 3:16; Psa 23"
          aria-label="References"
          className={cn(fieldGap, inputClass)}
        />
      ) : (
        <>
          <label className={cn(labelClass, labelGap)}>References</label>
          <input
            value={refsText}
            onChange={(e) => setRefsText(e.target.value)}
            placeholder="John 3:16-17; Psa 23"
            className={cn(fieldGap, inputClass)}
          />
        </>
      )}

      {compact ? (
        <div className={fieldGap}>
          <TagsInput tags={tags} onChange={setTags} />
        </div>
      ) : (
        <>
          <label className={cn(labelClass, labelGap)}>Tags</label>
          <div className={fieldGap}>
            <TagsInput tags={tags} onChange={setTags} />
          </div>
        </>
      )}

      {/* Visibility + Logos pills share a single row in compact mode so
          they don't each claim their own label strip. */}
      {compact ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1",
            sectionGap,
          )}
        >
          <div className="flex items-center gap-1">
            <span className={labelClass}>Vis</span>
            <div className="flex gap-1">
              {(["private", "guests", "public"] as DotVisibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    pillClass,
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
          {dot.kind === "logos" && (
            <div className="flex items-center gap-1">
              <span className={labelClass}>Logos</span>
              <div className="flex gap-1">
                {(["logos", "rhema", "both"] as LogosTag[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLogosTag(t)}
                    className={cn(
                      pillClass,
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
        </div>
      ) : (
        <>
          {dot.kind === "logos" && (
            <div className={fieldGap}>
              <div className={cn(labelClass, labelGap)}>Logos tag</div>
              <div className="flex gap-2">
                {(["logos", "rhema", "both"] as LogosTag[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setLogosTag(t)}
                    className={cn(
                      pillClass,
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
          <div className={sectionGap}>
            <div className={cn(labelClass, labelGap)}>Visibility</div>
            <div className="flex gap-2">
              {(["private", "guests", "public"] as DotVisibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    pillClass,
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
        </>
      )}

      <div
        className={cn(
          "mt-auto flex items-center justify-between gap-2 border-t border-[var(--color-rule)]",
          compact ? "pt-1" : "pt-4",
        )}
      >
        <div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className={cn(
                "rounded font-semibold text-red-700 hover:bg-red-50",
                footerBtn,
              )}
            >
              Delete
            </button>
          )}
        </div>
        <div className={cn("flex", compact ? "gap-1" : "gap-2")}>
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              "rounded text-[var(--color-ink-2)] hover:bg-black/5",
              footerBtn,
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={cn(
              "rounded bg-[var(--color-ink)] font-semibold text-[var(--color-paper)] hover:opacity-90",
              saveBtn,
            )}
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
