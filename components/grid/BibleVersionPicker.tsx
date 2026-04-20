"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Translation, TranslationGroup } from "@/lib/bible/translations";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Pre-grouped, pre-filtered list (e.g. limited to translations that cover
   * the current book's testament). The picker mirrors the order it's given.
   */
  groups: { group: TranslationGroup; items: Translation[] }[];
  /** Currently active translation id; pre-highlighted on open. */
  currentId: string;
  /** Returns false when the operator hasn't configured this provider's key. */
  isConfigured: (id: string) => boolean;
  /** Commit a selection. Only invoked for configured entries. */
  onSelect: (id: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

interface FlatRow {
  /** Section group (used to render sticky group headers between rows). */
  group: TranslationGroup;
  /** Position within the visible flat list — used for highlight state. */
  index: number;
  t: Translation;
  configured: boolean;
}

/**
 * Filter + flatten the grouped registry into a single list of selectable
 * rows. The query matches against id, label, fullName, language, and group
 * (normalized to ignore punctuation/case so "1cor", "1 cor" and "1Co" all
 * find the same entry).
 */
function buildRows(
  groups: Props["groups"],
  query: string,
  isConfigured: Props["isConfigured"],
): FlatRow[] {
  const q = normalize(query);
  const rows: FlatRow[] = [];
  let i = 0;
  for (const g of groups) {
    for (const t of g.items) {
      if (q) {
        const haystack = normalize(
          `${t.id} ${t.label} ${t.fullName} ${t.language} ${g.group}`,
        );
        if (!haystack.includes(q)) continue;
      }
      rows.push({
        group: g.group,
        index: i++,
        t,
        configured: isConfigured(t.id),
      });
    }
  }
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────

export function BibleVersionPicker({
  open,
  onClose,
  groups,
  currentId,
  isConfigured,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(
    () => buildRows(groups, query, isConfigured),
    [groups, query, isConfigured],
  );

  // When the dialog opens: reset query, focus the input, and pre-highlight
  // the row matching the current selection so Enter is a no-op confirm.
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    const idx = rows.findIndex((r) => r.t.id === currentId && r.configured);
    setHighlight(idx >= 0 ? idx : 0);
    // Defer to end of frame so the input is mounted.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    // We deliberately depend only on `open` — running this on every `rows`
    // change would steal focus while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Whenever the visible row set shrinks past the highlight (e.g. after a
  // keystroke), clamp the highlight to the new last row.
  useEffect(() => {
    if (highlight > rows.length - 1) setHighlight(Math.max(0, rows.length - 1));
  }, [rows.length, highlight]);

  // Scroll the highlighted row into view as the user arrows around.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  // Skip past disabled rows when arrowing. Returns the next index in
  // `direction` that is configured, or `start` if none found.
  const nextEnabled = useCallback(
    (start: number, direction: 1 | -1): number => {
      if (rows.length === 0) return 0;
      let i = start;
      for (let step = 0; step < rows.length; step++) {
        i = (i + direction + rows.length) % rows.length;
        if (rows[i].configured) return i;
      }
      return start;
    },
    [rows],
  );

  const commit = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => nextEnabled(h, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => nextEnabled(h, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row && row.configured) commit(row.t.id);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(Math.max(0, rows.length - 1));
      return;
    }
  };

  if (!open) return null;

  // Track the previous group so we only render a header when it changes —
  // gives the flat list visual structure without per-item duplication.
  let prevGroup: TranslationGroup | null = null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Select Bible translation"
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close translation picker"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
      />
      <div
        // Stop propagation so clicking inside the panel doesn't dismiss.
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-rule)] bg-white shadow-[0_24px_48px_-12px_rgba(31,27,22,0.45)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-rule)] px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-ink-2)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search translations…  (KJV, ESV, Hebrew, NLT, NIV…)"
            aria-label="Search translations"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-2)]/50 focus:outline-none"
          />
          <kbd className="hidden shrink-0 select-none rounded border border-[var(--color-rule)] bg-[var(--color-paper)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-2)] sm:inline">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[var(--color-ink-2)]">
              No translations match{" "}
              <span className="font-mono text-[var(--color-ink)]">
                {query}
              </span>
              .
            </div>
          ) : (
            <ul role="listbox">
              {rows.map((row) => {
                const isHeader = row.group !== prevGroup;
                prevGroup = row.group;
                return (
                  <li key={row.t.id}>
                    {isHeader && (
                      <div className="mt-1 px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                        {row.group}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={row.index === highlight}
                      data-row-index={row.index}
                      disabled={!row.configured}
                      onMouseEnter={() => setHighlight(row.index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (row.configured) commit(row.t.id);
                      }}
                      title={
                        row.configured
                          ? row.t.fullName
                          : `${row.t.fullName}\n\nNot configured: set ${row.t.requiresEnvKey} in .env.local.`
                      }
                      className={cn(
                        "flex w-full items-baseline gap-3 px-3 py-1.5 text-left transition-colors",
                        row.index === highlight && row.configured
                          ? "bg-[var(--color-ink)]/[0.06]"
                          : "hover:bg-black/[0.03]",
                        !row.configured && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="w-12 shrink-0 font-mono text-[12px] uppercase tracking-wider text-[var(--color-ink)]">
                        {row.t.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-serif text-[14px] leading-tight text-[var(--color-ink)]">
                        {row.t.fullName}
                      </span>
                      <Badges t={row.t} configured={row.configured} />
                      {row.t.id === currentId && (
                        <span
                          aria-label="Currently selected"
                          className="text-[var(--color-ink-2)]"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
          <div className="flex items-center gap-3">
            <Hint k="↑↓" label="navigate" />
            <Hint k="↵" label="select" />
            <Hint k="esc" label="close" />
          </div>
          <span className="hidden sm:inline">
            {rows.length} {rows.length === 1 ? "translation" : "translations"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function Badges({
  t,
  configured,
}: {
  t: Translation;
  configured: boolean;
}) {
  return (
    <span className="hidden shrink-0 items-center gap-1 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)] sm:inline-flex">
      {t.hasStrongs && (
        <span
          title="Includes Strong's tags — drives the BDB / Thayer's word study."
          className="rounded border border-[var(--color-rule)] bg-white px-1 py-0.5 text-[var(--color-ink)]"
        >
          ✦
        </span>
      )}
      {t.license === "copyrighted" && (
        <span
          title="Served via bolls.life without an explicit publisher license."
          className="rounded border border-amber-300/70 bg-amber-50 px-1 py-0.5 text-amber-800"
        >
          © unlicensed
        </span>
      )}
      {t.license === "licensed-via-publisher-api" && (
        <span
          title={`Served via the official ${t.provider.toUpperCase()} API.`}
          className="rounded border border-emerald-300/70 bg-emerald-50 px-1 py-0.5 text-emerald-800"
        >
          ⚐ via {t.provider.toUpperCase()}
        </span>
      )}
      {!configured && (
        <span
          title={`Set ${t.requiresEnvKey} in .env.local to enable.`}
          className="rounded border border-rose-300/70 bg-rose-50 px-1 py-0.5 font-mono text-rose-800"
        >
          set {t.requiresEnvKey}
        </span>
      )}
    </span>
  );
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-[var(--color-rule)] bg-white px-1 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--color-ink)]">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
