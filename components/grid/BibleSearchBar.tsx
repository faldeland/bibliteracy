"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BIBLE_BOOKS, type BibleBook } from "@/lib/bible/books";
import { parseSingleRef } from "@/lib/bible/parseRef";
import { verseCount } from "@/lib/bible/versesPerChapter";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface BibleNavTarget {
  bookId: string;
  chapter: number;
  verse: number;
}

interface Props {
  current: BibleNavTarget;
  onNavigate: (target: BibleNavTarget) => void;
  recents: BibleNavTarget[];
}

// ─── Alias table for autocomplete scoring ────────────────────────────────
//
// `parseSingleRef` already understands all of these for actual ref parsing;
// we duplicate the small list here so the typeahead can also score against
// common abbreviations that aren't in `book.name`/`book.abbr`/`book.id`.

const EXTRA_ALIASES: Record<string, string[]> = {
  Gen: ["Ge", "Gn", "Genesis"],
  Exo: ["Ex", "Exod", "Exodus"],
  Lev: ["Lv", "Leviticus"],
  Num: ["Nm", "Nu", "Numbers"],
  Deu: ["Dt", "Deut", "Deuteronomy"],
  Jos: ["Jsh", "Josh", "Joshua"],
  Jdg: ["Judg", "Jg", "Judges"],
  "1Sa": ["1Sm", "1Sam", "1Samuel"],
  "2Sa": ["2Sm", "2Sam", "2Samuel"],
  "1Ki": ["1Kg", "1Kgs", "1Kings"],
  "2Ki": ["2Kg", "2Kgs", "2Kings"],
  "1Ch": ["1Chr", "1Chron", "1Chronicles"],
  "2Ch": ["2Chr", "2Chron", "2Chronicles"],
  Ezr: ["Ezra"],
  Neh: ["Nehemiah"],
  Est: ["Esth", "Esther"],
  Psa: ["Ps", "Psalm", "Psalms"],
  Pro: ["Pr", "Prov", "Proverbs"],
  Ecc: ["Eccl", "Qoh", "Qoheleth", "Ecclesiastes"],
  Sng: ["Song", "SoS", "SongOfSongs", "SongOfSolomon", "Cant", "Canticles"],
  Isa: ["Is", "Isaiah"],
  Jer: ["Jr", "Jeremiah"],
  Lam: ["La", "Lamentations"],
  Eze: ["Ezk", "Ezek", "Ezekiel"],
  Dan: ["Dn", "Daniel"],
  Hos: ["Ho", "Hosea"],
  Joe: ["Jl", "Joel"],
  Amo: ["Am", "Amos"],
  Oba: ["Ob", "Obad", "Obadiah"],
  Jon: ["Jnh", "Jonah"],
  Mic: ["Mi", "Micah"],
  Nah: ["Na", "Nahum"],
  Hab: ["Hb", "Habakkuk"],
  Zep: ["Zph", "Zeph", "Zephaniah"],
  Hag: ["Hg", "Haggai"],
  Zec: ["Zch", "Zech", "Zechariah"],
  Mal: ["Ml", "Malachi"],
  Mat: ["Mt", "Matt", "Matthew"],
  Mrk: ["Mk", "Mark"],
  Luk: ["Lk", "Luke"],
  Jhn: ["Jn", "Joh", "John"],
  Act: ["Ac", "Acts"],
  Rom: ["Ro", "Rm", "Romans"],
  "1Co": ["1Cor", "1Corinthians"],
  "2Co": ["2Cor", "2Corinthians"],
  Gal: ["Galatians"],
  Eph: ["Ephesians"],
  Php: ["Phil", "Phl", "Philippians"],
  Col: ["Colossians"],
  "1Th": ["1Thess", "1Thessalonians"],
  "2Th": ["2Thess", "2Thessalonians"],
  "1Ti": ["1Tim", "1Timothy"],
  "2Ti": ["2Tim", "2Timothy"],
  Tit: ["Titus"],
  Phm: ["Phlm", "Philemon"],
  Heb: ["Hebrews"],
  Jas: ["Jm", "Jam", "James"],
  "1Pe": ["1Pt", "1Pet", "1Peter"],
  "2Pe": ["2Pt", "2Pet", "2Peter"],
  "1Jn": ["1Jhn", "1John"],
  "2Jn": ["2Jhn", "2John"],
  "3Jn": ["3Jhn", "3John"],
  Jud: ["Jude"],
  Rev: ["Re", "Apoc", "Apocalypse", "Revelation"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Greedy partial parse: pulls trailing `chapter[:verse]` off the input. */
function partialParse(raw: string): {
  bookQuery: string;
  chapter?: number;
  hasColon: boolean;
  verse?: number;
} {
  let s = raw.trim();
  let chapter: number | undefined;
  let verse: number | undefined;
  let hasColon = false;

  const vm = s.match(/(\d+)\s*[:.]\s*(\d*)$/);
  if (vm) {
    chapter = Number(vm[1]);
    if (vm[2]) verse = Number(vm[2]);
    hasColon = true;
    s = s.slice(0, vm.index!).trim();
  } else {
    const cm = s.match(/(\d+)\s*$/);
    if (cm) {
      chapter = Number(cm[1]);
      s = s.slice(0, cm.index!).trim();
    }
  }
  return { bookQuery: s, chapter, hasColon, verse };
}

/**
 * Score a query against a book using its name, abbr, id, and the extra
 * alias list above. Higher = better; 0 means no match.
 *
 * Tiers (descending):
 *   exact normalized match            → 1000
 *   normalized prefix                 →  900 − leftover length
 *   normalized substring (non-prefix) →  700 − offset
 *   fuzzy subsequence                 →  400 − total gap
 */
function scoreBook(query: string, book: BibleBook): number {
  const q = normalize(query);
  if (!q) return 0;
  const candidates = [
    book.name,
    book.abbr,
    book.id,
    ...(EXTRA_ALIASES[book.id] ?? []),
  ];
  let best = 0;
  for (const cand of candidates) {
    const n = normalize(cand);
    if (!n) continue;
    if (n === q) return 1000;
    if (n.startsWith(q)) {
      best = Math.max(best, 900 - (n.length - q.length));
      continue;
    }
    const idx = n.indexOf(q);
    if (idx >= 0) {
      best = Math.max(best, 700 - idx);
      continue;
    }
    let lastIdx = -1;
    let gaps = 0;
    let ok = true;
    for (const ch of q) {
      const j = n.indexOf(ch, lastIdx + 1);
      if (j < 0) {
        ok = false;
        break;
      }
      gaps += j - lastIdx - 1;
      lastIdx = j;
    }
    if (ok) best = Math.max(best, 400 - gaps);
  }
  return best;
}

interface Suggestion {
  key: string;
  target: BibleNavTarget;
  primary: string;
  secondary: string;
  kind: "verse" | "chapter" | "book" | "recent";
  book: BibleBook;
}

interface VersePillBlock {
  book: BibleBook;
  chapter: number;
  verses: number[];
  totalVerses: number;
}

function buildSuggestions(
  query: string,
  recents: BibleNavTarget[],
): { suggestions: Suggestion[]; versePills?: VersePillBlock } {
  const q = query.trim();

  if (!q) {
    const seen = new Set<string>();
    const suggestions: Suggestion[] = [];
    for (const r of recents) {
      const key = `${r.bookId}-${r.chapter}-${r.verse}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const b = BIBLE_BOOKS.find((x) => x.id === r.bookId);
      if (!b) continue;
      suggestions.push({
        key: `recent-${key}`,
        target: r,
        primary: `${b.name} ${r.chapter}:${r.verse}`,
        secondary: `${b.testament} · ${b.section}`,
        kind: "recent",
        book: b,
      });
      if (suggestions.length >= 6) break;
    }
    return { suggestions };
  }

  const fullRef = parseSingleRef(q);
  const { bookQuery, chapter, hasColon, verse } = partialParse(q);
  const searchTerm = bookQuery || q;

  const ranked = BIBLE_BOOKS.map((b) => ({ b, s: scoreBook(searchTerm, b) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);

  const suggestions: Suggestion[] = [];

  if (fullRef) {
    const b = BIBLE_BOOKS.find((x) => x.id === fullRef.book);
    if (b) {
      const v = fullRef.verseStart ?? 1;
      suggestions.push({
        key: `verse-${b.id}-${fullRef.chapter}-${v}`,
        target: { bookId: b.id, chapter: fullRef.chapter, verse: v },
        primary: `${b.name} ${fullRef.chapter}:${v}`,
        secondary: `${b.testament} · ${b.section}`,
        kind: "verse",
        book: b,
      });
    }
  }

  if (
    !fullRef &&
    ranked.length > 0 &&
    chapter !== undefined &&
    !hasColon &&
    chapter >= 1 &&
    chapter <= ranked[0].b.chapters
  ) {
    const top = ranked[0].b;
    suggestions.push({
      key: `chapter-${top.id}-${chapter}`,
      target: { bookId: top.id, chapter, verse: 1 },
      primary: `${top.name} ${chapter}`,
      secondary: `${top.testament} · ${top.section} · chapter ${chapter} of ${top.chapters}`,
      kind: "chapter",
      book: top,
    });
  }

  for (const { b } of ranked) {
    if (suggestions.some((s) => s.book.id === b.id && s.kind !== "recent")) {
      continue;
    }
    suggestions.push({
      key: `book-${b.id}`,
      target: { bookId: b.id, chapter: 1, verse: 1 },
      primary: b.name,
      secondary: `${b.testament} · ${b.section} · ${b.chapters} chapters`,
      kind: "book",
      book: b,
    });
    if (suggestions.length >= 8) break;
  }

  let versePills: VersePillBlock | undefined;
  if (hasColon && ranked.length && chapter !== undefined) {
    const top = ranked[0].b;
    if (chapter >= 1 && chapter <= top.chapters) {
      const total = verseCount(top.id, chapter) ?? 0;
      const all = Array.from({ length: total }, (_, i) => i + 1);
      const filtered =
        verse !== undefined
          ? all.filter((v) => String(v).startsWith(String(verse)))
          : all;
      if (filtered.length > 0) {
        versePills = {
          book: top,
          chapter,
          verses: filtered,
          totalVerses: total,
        };
      }
    }
  }

  return { suggestions, versePills };
}

// ─── Component ────────────────────────────────────────────────────────────

export function BibleSearchBar({ current, onNavigate, recents }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { suggestions, versePills } = useMemo(
    () => buildSuggestions(query, recents),
    [query, recents],
  );

  // Reset highlight when the candidate set changes.
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Position the floating dropdown using fixed coords so it can escape the
  // grid container's overflow:hidden.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setRect({ left: r.left, top: r.bottom + 6, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Click outside (input wrapper AND dropdown) closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (wrapRef.current?.contains(t)) return;
      if (t.closest("[data-bible-search-dropdown]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ⌘S / Ctrl+S and "/" focus the bar from anywhere on the page. ⌘S
  // normally triggers the browser "Save Page" dialog; we intercept it
  // before the default fires so Bibliteracy gets the keystroke instead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
        return;
      }
      if (e.key === "/") {
        const a = document.activeElement as HTMLElement | null;
        const tag = a?.tagName;
        const editable = a?.isContentEditable;
        if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commit = useCallback(
    (target: BibleNavTarget) => {
      onNavigate(target);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    },
    [onNavigate],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sug = suggestions[highlight];
      if (sug) commit(sug.target);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === "Tab" && suggestions[highlight]) {
      // Tab-complete the highlighted book's name into the input so the user
      // can keep typing the chapter/verse.
      const sug = suggestions[highlight];
      if (sug.kind === "book" || sug.kind === "recent") {
        e.preventDefault();
        setQuery(sug.book.name + " ");
      }
    }
  };

  const currentBook = BIBLE_BOOKS.find((b) => b.id === current.bookId);
  const placeholder = currentBook
    ? `${currentBook.name} ${current.chapter}:${current.verse}`
    : "Jump to a verse…";

  const showDropdown = open && (suggestions.length > 0 || !!versePills);

  return (
    <div ref={wrapRef} className="relative w-full max-w-[18.9rem]">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 transition-all",
          open
            ? "border-[var(--color-ink)]/40 shadow-[0_2px_12px_-4px_rgba(31,27,22,0.25)]"
            : "border-[var(--color-rule)] hover:border-[var(--color-ink-2)]/40",
        )}
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-ink-2)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search Bible reference"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-2)]/50 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="rounded text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          >
            <ClearIcon className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="hidden shrink-0 select-none rounded border border-[var(--color-rule)] bg-[var(--color-paper)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-2)] sm:inline">
          ⌘S
        </kbd>
      </div>

      {showDropdown && rect && (
        <div
          data-bible-search-dropdown
          role="listbox"
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top,
            width: rect.width,
          }}
          className="z-50 overflow-hidden rounded-xl border border-[var(--color-rule)] bg-white shadow-[0_12px_32px_-8px_rgba(31,27,22,0.35)]"
        >
          {suggestions.length === 0 && !versePills ? (
            <div className="px-3 py-4 text-sm text-[var(--color-ink-2)]">
              No matches. Try{" "}
              <span className="font-mono text-[var(--color-ink)]">jn 3:16</span>{" "}
              or <span className="font-mono text-[var(--color-ink)]">psa 23</span>.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {suggestions.map((s, i) => (
                <li key={s.key} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(s.target);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      i === highlight
                        ? "bg-[var(--color-ink)]/[0.06]"
                        : "hover:bg-black/[0.03]",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        s.book.testament === "OT"
                          ? "bg-[var(--color-logos)]"
                          : "bg-[var(--color-prayer)]",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-serif text-[15px] leading-tight text-[var(--color-ink)]">
                        {s.primary}
                      </div>
                      <div className="truncate text-[11px] text-[var(--color-ink-2)]">
                        {s.secondary}
                      </div>
                    </div>
                    <KindTag kind={s.kind} />
                    {i === highlight && (
                      <span className="hidden text-[10px] uppercase tracking-widest text-[var(--color-ink-2)] sm:inline">
                        ↵
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {versePills && (
            <div className="border-t border-[var(--color-rule)] bg-[var(--color-paper)] px-2 py-2">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
                  {versePills.book.name} {versePills.chapter}
                </span>
                <span className="text-[10px] text-[var(--color-ink-2)]/70">
                  {versePills.verses.length} of {versePills.totalVerses} verses
                </span>
              </div>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {versePills.verses.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit({
                        bookId: versePills.book.id,
                        chapter: versePills.chapter,
                        verse: v,
                      });
                    }}
                    className="rounded-md px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink)] hover:bg-[var(--color-ink)]/10"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tiny presentational helpers ─────────────────────────────────────────

function KindTag({ kind }: { kind: Suggestion["kind"] }) {
  const label =
    kind === "verse"
      ? "Verse"
      : kind === "chapter"
        ? "Chapter"
        : kind === "recent"
          ? "Recent"
          : "Book";
  return (
    <span className="hidden shrink-0 rounded border border-[var(--color-rule)] bg-[var(--color-paper)] px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[var(--color-ink-2)] md:inline">
      {label}
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

function ClearIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m0-6-6 6" />
    </svg>
  );
}
