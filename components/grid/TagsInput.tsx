"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Free-form tag editor. Mirrors the interaction of `RefTagsInput` (the Bible
 * reference tag field in the composer) so users get a consistent feel: type
 * a word, press Enter / comma / semicolon / Tab to commit it into a pill,
 * Backspace on an empty field pops the last pill.
 *
 * Tags are normalized for storage (trimmed, collapsed whitespace, lowercased)
 * and deduped case-insensitively. We intentionally keep the stored form
 * lowercase so filtering queries don't need to care about casing.
 */
export function TagsInput({
  tags,
  onChange,
  placeholder = "Add tags (e.g. gospel, mission, prayer-request)",
}: {
  tags: string[];
  onChange(next: string[]): void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => normalizeTag(draft), [draft]);
  const wouldDuplicate = useMemo(
    () => !!normalized && tags.some((t) => t === normalized),
    [normalized, tags],
  );

  function commit(raw: string): "ok" | "empty" | "duplicate" {
    const tag = normalizeTag(raw);
    if (!tag) return "empty";
    if (tags.some((t) => t === tag)) return "duplicate";
    onChange([...tags, tag]);
    return "ok";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      if (!draft.trim()) {
        // Let Tab fall through so users can keyboard-navigate out of the field.
        return;
      }
      e.preventDefault();
      const result = commit(draft);
      if (result === "duplicate") {
        // Silently clear — the tag is already present, nothing to complain about.
        setDraft("");
        setError(null);
        return;
      }
      setDraft("");
      setError(null);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  }

  function handleBlur() {
    if (!draft.trim()) return;
    commit(draft);
    setDraft("");
    setError(null);
  }

  function removeAt(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div
        className={cn(
          "flex w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-sm outline-none focus-within:border-[var(--color-ink-2)]",
          error ? "border-red-500" : "border-[var(--color-rule)]",
        )}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-tag-pill]")) return;
          const input = e.currentTarget.querySelector("input");
          input?.focus();
        }}
      >
        {tags.map((t, i) => (
          <TagPill key={`${t}-${i}`} label={t} onRemove={() => removeAt(i)} />
        ))}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : "Add another…"}
          aria-label="Add tag"
          aria-invalid={wouldDuplicate}
          className="min-w-[10rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-[var(--color-ink-2)]/60"
        />
      </div>
    </div>
  );
}

function TagPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove(): void;
}) {
  return (
    <span
      data-tag-pill
      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-2)]/70 py-0.5 pl-2 pr-0.5 text-xs text-[var(--color-ink)]"
    >
      <span>#{label}</span>
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

/**
 * Collapse whitespace, trim, lowercase. Returns "" for tags that would be
 * empty or pure whitespace after normalization.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
