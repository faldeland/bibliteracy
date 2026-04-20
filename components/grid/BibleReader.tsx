"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import {
  DEFAULT_TRANSLATION_ID,
  getTranslation,
  groupTranslations,
  translationCovers,
  translationsFor,
} from "@/lib/bible/translations";
import { matchTrustedWork } from "@/lib/llm/trustedSources";
import {
  endSession as endVerseSession,
  formatDuration,
  getAllVerseStats,
  startSession as startVerseSession,
  subscribe as subscribeVerseSessions,
  verseKey,
  type TrackerSnapshot,
  type VerseStats,
} from "@/lib/study/verseSessions";
import { BibleSearchBar, type BibleNavTarget } from "./BibleSearchBar";
import { BibleVersionPicker } from "./BibleVersionPicker";
import { WordDeepDiveDrawer } from "./WordDeepDiveDrawer";
import { cn } from "@/lib/utils";

// ─── Types matching the /api/bible/* responses ────────────────────────────

interface VerseToken {
  text: string;
  strong: string | null;
}
interface ParsedVerse {
  verse: number;
  tokens: VerseToken[];
  plain: string;
}
interface ChapterResponse {
  book: string;
  chapter: number;
  /** Translation actually rendered (after server-side fallback). */
  translation?: string;
  /** Publisher attribution string (from the registry entry). */
  attribution?: string | null;
  verses: ParsedVerse[];
  error?: string;
  /** Name of an env var the operator must set to enable this translation. */
  configMissing?: string;
}

interface ProvidersResponse {
  providers: Record<
    string,
    { configured: boolean; requiresEnvKey: string }
  >;
}
interface WordStudy {
  strong: string;
  lexeme: string;
  transliteration: string;
  pronunciation: string;
  shortGloss: string;
  detailHtml: string;
}
interface WordsResponse {
  words: Record<string, WordStudy>;
  error?: string;
}
interface WordUsageSource {
  citation: string;
  type:
    | "lexicon"
    | "grammar"
    | "primary_text"
    | "database"
    | "monograph"
    | "other";
  locus?: string | null;
  /** Deep link on the server-side allowlist; null if none provided. */
  url?: string | null;
}
interface WordUsage {
  strong: string;
  /** e.g. "Koine Greek, 1st century AD". */
  period: string;
  /** 2-4 sentence note on how the word was commonly used in its own day. */
  commonUsage: string;
  /** 0-4 short bullets of extra-biblical connotations. */
  connotations: string[];
  /** Cross-references the model attested it drew on (truth-rules enforced). */
  sources: WordUsageSource[];
  /** Set when the model refused to answer; UI hides the section. */
  refusalReason: string | null;
  /** Optional scholarly uncertainty caveat (null when well-attested). */
  uncertainty?: string | null;
  model: string;
}
interface UsageResponse {
  usage?: WordUsage | null;
  /** False when PIPELLM_API_KEY is unset; UI hides the section entirely. */
  configured?: boolean;
  error?: string;
}
interface XRefResponse {
  query?: { book: string; chapter: number; verseStart?: number };
  label?: string;
  count: number;
  results: Array<{
    to: { book: string; chapter: number; verseStart?: number; verseEnd?: number };
    toLabel: string;
    category:
      | "ot-in-nt"
      | "synoptic-parallel"
      | "thematic-chain"
      | "messianic"
      | "narrative-parallel";
    note: string;
  }>;
  error?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  "ot-in-nt": "OT in NT",
  "synoptic-parallel": "Synoptic parallel",
  "thematic-chain": "Thematic chain",
  messianic: "Messianic",
  "narrative-parallel": "Narrative parallel",
};

// ─── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_BOOK = "Jhn";
const DEFAULT_CHAPTER = 3;
const DEFAULT_VERSE = 16;

const RECENTS_STORAGE_KEY = "bibliteracy:bible:recents";
const RECENTS_MAX = 8;
const TRANSLATION_STORAGE_KEY = "bibliteracy:bible:translation";

// ─── Component ────────────────────────────────────────────────────────────

export function BibleReader() {
  const [bookId, setBookId] = useState<string>(DEFAULT_BOOK);
  const [chapter, setChapter] = useState<number>(DEFAULT_CHAPTER);
  const [verse, setVerse] = useState<number>(DEFAULT_VERSE);

  const book = useMemo(
    () => BIBLE_BOOKS.find((b) => b.id === bookId) ?? BIBLE_BOOKS[0],
    [bookId],
  );

  // ── Translation (persisted in localStorage) ────────────────────────────
  // The picker exposes every translation served by bolls.life (see
  // lib/bible/translations.ts). Translations whose `hasStrongs` is true
  // drive the per-word interlinear; others render as a plain paragraph.
  // When the user navigates to a book in a testament the current translation
  // doesn't cover (e.g. WLCa is OT-only and they jump to John), we
  // transparently swap to the default for that session without overwriting
  // their stored preference.
  const [translationId, setTranslationId] = useState<string>(
    DEFAULT_TRANSLATION_ID,
  );
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TRANSLATION_STORAGE_KEY);
      if (stored) setTranslationId(stored);
    } catch {
      // ignore privacy-mode / quota errors
    }
  }, []);
  const handleTranslationChange = useCallback((id: string) => {
    setTranslationId(id);
    try {
      window.localStorage.setItem(TRANSLATION_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);
  const preferredTranslation = useMemo(
    () => getTranslation(translationId),
    [translationId],
  );
  const effectiveTranslation = useMemo(
    () =>
      translationCovers(preferredTranslation, book.testament)
        ? preferredTranslation
        : getTranslation(DEFAULT_TRANSLATION_ID),
    [preferredTranslation, book.testament],
  );
  const availableTranslations = useMemo(
    () => translationsFor(book.testament),
    [book.testament],
  );
  const availableTranslationGroups = useMemo(
    () => groupTranslations(availableTranslations),
    [availableTranslations],
  );

  // ── Provider availability (which publisher-API keys are configured) ───
  // We fetch this once on mount and use it to disable picker entries that
  // can't fetch in the current deployment (e.g. ESV without ESV_API_KEY).
  const [providerStatus, setProviderStatus] = useState<
    Record<string, { configured: boolean; requiresEnvKey: string }>
  >({});
  useEffect(() => {
    let aborted = false;
    fetch("/api/bible/providers")
      .then((r) => r.json() as Promise<ProvidersResponse>)
      .then((data) => {
        if (aborted) return;
        if (data?.providers) setProviderStatus(data.providers);
      })
      .catch(() => {
        // Non-fatal; entries will still be selectable and produce a
        // server-side error if the key turns out to be missing.
      });
    return () => {
      aborted = true;
    };
  }, []);
  const isTranslationConfigured = useCallback(
    (id: string) => {
      const status = providerStatus[id];
      return !status || status.configured;
    },
    [providerStatus],
  );

  // ── Version picker (⌘D) ───────────────────────────────────────────────
  // Opens a searchable command-palette-style modal. We bind ⌘D/Ctrl+D
  // globally and always preventDefault so the browser's "bookmark this
  // page" dialog doesn't pop up on top of our picker.
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() !== "d") return;
      e.preventDefault();
      setPickerOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Recents (persisted in localStorage) ────────────────────────────────
  const [recents, setRecents] = useState<BibleNavTarget[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecents(
          parsed.filter(
            (r): r is BibleNavTarget =>
              !!r &&
              typeof r.bookId === "string" &&
              typeof r.chapter === "number" &&
              typeof r.verse === "number",
          ),
        );
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  const handleNavigate = useCallback((target: BibleNavTarget) => {
    setBookId(target.bookId);
    setChapter(target.chapter);
    setVerse(target.verse);
    setRecents((prev) => {
      const filtered = prev.filter(
        (r) =>
          !(
            r.bookId === target.bookId &&
            r.chapter === target.chapter &&
            r.verse === target.verse
          ),
      );
      const next = [target, ...filtered].slice(0, RECENTS_MAX);
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / privacy mode
      }
      return next;
    });
  }, []);

  // ── Chapter load ───────────────────────────────────────────────────────

  const [chapterData, setChapterData] = useState<ParsedVerse[] | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [chapterConfigMissing, setChapterConfigMissing] = useState<
    string | null
  >(null);
  const [chapterAttribution, setChapterAttribution] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let aborted = false;
    const ctl = new AbortController();
    setChapterLoading(true);
    setChapterError(null);
    setChapterConfigMissing(null);
    setChapterAttribution(null);
    setChapterData(null);
    fetch(
      `/api/bible/chapter?book=${bookId}&chapter=${chapter}&translation=${encodeURIComponent(effectiveTranslation.id)}`,
      { signal: ctl.signal },
    )
      .then(async (r) => (await r.json()) as ChapterResponse)
      .then((data) => {
        if (aborted) return;
        if (data.error) {
          setChapterError(data.error);
          if (data.configMissing) setChapterConfigMissing(data.configMissing);
          return;
        }
        setChapterData(data.verses);
        setChapterAttribution(data.attribution ?? null);
        // Snap verse into range.
        if (verse > data.verses.length) setVerse(data.verses.length || 1);
      })
      .catch((e) => {
        if (aborted) return;
        if ((e as Error).name === "AbortError") return;
        setChapterError((e as Error).message);
      })
      .finally(() => {
        if (!aborted) setChapterLoading(false);
      });
    return () => {
      aborted = true;
      ctl.abort();
    };
    // We deliberately omit `verse` so changing only the verse doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapter, effectiveTranslation.id]);

  const currentVerse = useMemo<ParsedVerse | null>(() => {
    if (!chapterData) return null;
    return chapterData.find((v) => v.verse === verse) ?? chapterData[0] ?? null;
  }, [chapterData, verse]);

  // ── Prev/next verse navigation ────────────────────────────────────────
  // Flow rules: step through verses within a chapter, then across chapters
  // within a book, then across books along the canonical `order` field
  // (which mirrors the BooksLane — TaNaK for OT, traditional NT ordering
  // after Malachi). When we cross a chapter boundary backwards we don't
  // know the previous chapter's verse count until it loads, so we ask for
  // verse 999 and let the chapter-load effect auto-clamp to the last
  // verse actually present in the fetched chapter.
  const prevTarget = useMemo<BibleNavTarget | null>(() => {
    if (verse > 1) return { bookId, chapter, verse: verse - 1 };
    if (chapter > 1) return { bookId, chapter: chapter - 1, verse: 999 };
    const prevBook = BIBLE_BOOKS.find((b) => b.order === book.order - 1);
    if (prevBook) {
      return { bookId: prevBook.id, chapter: prevBook.chapters, verse: 999 };
    }
    return null;
  }, [bookId, book, chapter, verse]);

  const nextTarget = useMemo<BibleNavTarget | null>(() => {
    const lastVerse = chapterData?.length ?? 0;
    if (lastVerse > 0 && verse < lastVerse) {
      return { bookId, chapter, verse: verse + 1 };
    }
    if (chapter < book.chapters) {
      return { bookId, chapter: chapter + 1, verse: 1 };
    }
    const nextBook = BIBLE_BOOKS.find((b) => b.order === book.order + 1);
    if (nextBook) return { bookId: nextBook.id, chapter: 1, verse: 1 };
    return null;
  }, [bookId, book, chapter, verse, chapterData]);

  // ── Verse-study session tracking ──────────────────────────────────────
  // Start a fresh session whenever the user lands on a new verse. The
  // tracker pauses accrual on idle / hidden-tab, so raw wall-clock time
  // doesn't get inflated. On unmount we flush the live session into
  // localStorage. Micro-sessions (<1s) are auto-dropped by the tracker
  // so programmatic double-nav / clamp-to-last-verse don't pollute stats.
  useEffect(() => {
    startVerseSession({ bookId, chapter, verse });
  }, [bookId, chapter, verse]);
  useEffect(() => {
    return () => endVerseSession();
  }, []);

  // ← / → anywhere on the page moves between verses, unless focus is in a
  // text field (so typing in the search bar still moves the caret).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const a = document.activeElement as HTMLElement | null;
      const tag = a?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || a?.isContentEditable) return;
      const target = e.key === "ArrowLeft" ? prevTarget : nextTarget;
      if (!target) return;
      e.preventDefault();
      handleNavigate(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevTarget, nextTarget, handleNavigate]);

  // ── KJV parallel reference ────────────────────────────────────────────
  // We always want a Strong's-tagged interlinear visible. If the user
  // picks a translation that doesn't carry Strong's tags, fetch KJV for
  // the same chapter and render its matching verse as a second row with
  // the full word-study UI underneath. Skipped when KJV is already the
  // selected translation (single interlinear is enough).
  const showKjvParallel =
    !effectiveTranslation.hasStrongs && effectiveTranslation.id !== "KJV";
  const [kjvVerses, setKjvVerses] = useState<ParsedVerse[] | null>(null);
  useEffect(() => {
    if (!showKjvParallel) {
      setKjvVerses(null);
      return;
    }
    let aborted = false;
    const ctl = new AbortController();
    fetch(
      `/api/bible/chapter?book=${bookId}&chapter=${chapter}&translation=KJV`,
      { signal: ctl.signal },
    )
      .then(async (r) => (await r.json()) as ChapterResponse)
      .then((data) => {
        if (aborted || data.error) return;
        setKjvVerses(data.verses);
      })
      .catch(() => {
        // Non-fatal — the parallel reference simply won't render.
      });
    return () => {
      aborted = true;
      ctl.abort();
    };
  }, [bookId, chapter, showKjvParallel]);
  const kjvCurrentVerse = useMemo<ParsedVerse | null>(() => {
    if (!kjvVerses) return null;
    return kjvVerses.find((v) => v.verse === verse) ?? null;
  }, [kjvVerses, verse]);

  // The verse whose Strong's tokens drive the word-study fetch + popover.
  // When the selected translation already has Strong's, that's it; when
  // we're showing a KJV parallel underneath, the popover hangs off the
  // KJV row instead.
  const studyVerse: ParsedVerse | null = effectiveTranslation.hasStrongs
    ? currentVerse
    : kjvCurrentVerse;

  // ── Word studies for the current verse ────────────────────────────────

  const [studies, setStudies] = useState<Record<string, WordStudy>>({});
  const studyCacheRef = useRef<Map<string, WordStudy>>(new Map());

  useEffect(() => {
    if (!studyVerse) return;
    const wanted = Array.from(
      new Set(
        studyVerse.tokens
          .map((t) => t.strong)
          .filter((s): s is string => !!s),
      ),
    );
    const missing = wanted.filter((s) => !studyCacheRef.current.has(s));

    // Always update the visible map so it reflects only this verse's tokens.
    const fromCache: Record<string, WordStudy> = {};
    for (const s of wanted) {
      const hit = studyCacheRef.current.get(s);
      if (hit) fromCache[s] = hit;
    }
    setStudies(fromCache);

    if (missing.length === 0) return;

    let aborted = false;
    const ctl = new AbortController();
    fetch(`/api/bible/words?strongs=${missing.join(",")}`, {
      signal: ctl.signal,
    })
      .then(async (r) => (await r.json()) as WordsResponse)
      .then((data) => {
        if (aborted || !data.words) return;
        for (const [k, v] of Object.entries(data.words)) {
          studyCacheRef.current.set(k, v);
        }
        setStudies((prev) => {
          const next = { ...prev };
          for (const s of wanted) {
            const hit = studyCacheRef.current.get(s);
            if (hit) next[s] = hit;
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      aborted = true;
      ctl.abort();
    };
  }, [studyVerse]);

  // ── Popover state ─────────────────────────────────────────────────────

  const [popover, setPopover] = useState<{
    strong: string;
    rect: DOMRect;
    pinned: boolean;
  } | null>(null);

  // Close pinned popover when user clicks outside it.
  useEffect(() => {
    if (!popover?.pinned) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-bible-popover]")) return;
      if (t.closest("[data-bible-token]")) return;
      setPopover(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popover?.pinned]);

  const onTokenEnter = useCallback((strong: string, el: HTMLElement) => {
    setPopover((cur) => {
      if (cur?.pinned) return cur;
      return { strong, rect: el.getBoundingClientRect(), pinned: false };
    });
  }, []);
  const onTokenLeave = useCallback(() => {
    setPopover((cur) => (cur?.pinned ? cur : null));
  }, []);
  const onTokenClick = useCallback((strong: string, el: HTMLElement) => {
    setPopover({ strong, rect: el.getBoundingClientRect(), pinned: true });
  }, []);

  const popoverStudy = popover ? studies[popover.strong] : null;

  // ── AI deep-dive drawer state ─────────────────────────────────────────
  // Independent of the popover so the user can dismiss the popover and
  // keep the drawer open while reading. The drawer fetches its own data
  // from /api/bible/deep-dive, keyed on this Strong's number.
  const [deepDiveStrong, setDeepDiveStrong] = useState<string | null>(null);
  const openDeepDive = useCallback((strong: string) => {
    setDeepDiveStrong(strong);
  }, []);
  const closeDeepDive = useCallback(() => setDeepDiveStrong(null), []);

  // ── Cross-references for the current verse ────────────────────────────
  // The dataset is small, static, and shipped with the app, so there's no
  // server load worry; we just call the API for caching + edge-friendliness.

  const [xrefs, setXrefs] = useState<XRefResponse["results"]>([]);
  useEffect(() => {
    if (!currentVerse) {
      setXrefs([]);
      return;
    }
    let aborted = false;
    const ctl = new AbortController();
    const url = `/api/bible/xrefs?book=${bookId}&chapter=${chapter}&verse=${currentVerse.verse}`;
    fetch(url, { signal: ctl.signal })
      .then(async (r) => (await r.json()) as XRefResponse)
      .then((data) => {
        if (aborted) return;
        setXrefs(data.results ?? []);
      })
      .catch(() => {
        if (!aborted) setXrefs([]);
      });
    return () => {
      aborted = true;
      ctl.abort();
    };
  }, [bookId, chapter, currentVerse]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <section
      className="border-b border-[var(--color-rule)] bg-[var(--color-paper)]"
      aria-label="Bible reading"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="hidden font-serif text-sm font-semibold text-[var(--color-ink)] sm:inline">
          Read
        </span>
        <div className="flex flex-1 items-center">
          <BibleSearchBar
            current={{ bookId, chapter, verse }}
            onNavigate={handleNavigate}
            recents={recents}
          />
        </div>

        <span className="hidden whitespace-nowrap text-[11px] text-[var(--color-ink-2)] md:inline">
          {book.name} {chapter}:{verse} · {effectiveTranslation.label}
          {effectiveTranslation.hasStrongs && " / BDB-Thayer\u2019s"}
          {effectiveTranslation.id !== preferredTranslation.id && (
            <span className="ml-1 italic text-[var(--color-ink-2)]/70">
              (fallback)
            </span>
          )}
          {effectiveTranslation.license === "copyrighted" && (
            <span
              className="ml-1 italic text-amber-700/80"
              title="This translation is copyrighted and is being served via bolls.life without a publisher license. Verify your usage rights before public deployment."
            >
              © unlicensed
            </span>
          )}
          {effectiveTranslation.license === "licensed-via-publisher-api" && (
            <span
              className="ml-1 italic text-emerald-700/80"
              title={`Served via the official ${effectiveTranslation.provider.toUpperCase()} API.`}
            >
              ⚐ via {effectiveTranslation.provider.toUpperCase()}
            </span>
          )}
        </span>

        {/* Translation picker — pinned to the far right, opposite the
            selected-verse info. Click or press ⌘D to open the searchable
            modal; the button itself shows the active selection so users
            always see what they're reading. */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title={`${preferredTranslation.fullName} — search translations (⌘D)`}
          aria-label={`Translation: ${preferredTranslation.label}. Open picker.`}
          aria-haspopup="dialog"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rule)] bg-white px-2 py-1 text-[11px] text-[var(--color-ink)] hover:border-[var(--color-ink-2)]/50"
        >
          <span className="font-mono uppercase tracking-wide">
            {preferredTranslation.label}
          </span>
          {effectiveTranslation.id !== preferredTranslation.id && (
            <span
              className="text-[10px] italic text-[var(--color-ink-2)]/70"
              title={`Falling back to ${effectiveTranslation.label} — ${preferredTranslation.label} doesn't cover ${book.testament}.`}
            >
              → {effectiveTranslation.label}
            </span>
          )}
          <kbd className="hidden rounded border border-[var(--color-rule)] bg-[var(--color-paper)] px-1 py-px font-mono text-[9px] uppercase tracking-widest text-[var(--color-ink-2)] sm:inline">
            ⌘D
          </kbd>
        </button>
      </div>

      {/* Verse line */}
      <div className="relative px-4 pb-3">
        {chapterError && chapterConfigMissing && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="font-semibold">
              {effectiveTranslation.label} isn&apos;t configured on this server.
            </div>
            <div className="mt-1">
              Set{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                {chapterConfigMissing}
              </code>{" "}
              in <code className="font-mono">.env.local</code> and restart{" "}
              <code className="font-mono">npm run dev</code>. Get a free key
              at the publisher&apos;s API site (see <code>.env.example</code>).
            </div>
          </div>
        )}
        {chapterError && !chapterConfigMissing && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            Couldn&apos;t load this passage: {chapterError}
          </div>
        )}
        {chapterLoading && !chapterError && (
          <div className="h-16 animate-pulse rounded-md bg-[var(--color-paper-2)]/50" />
        )}
        {!chapterLoading && !chapterError && currentVerse && (
          <>
            {/* Translation label — mirrors the KJV parallel label so every
                rendered verse is unambiguously attributed in-line. The
                publisher attribution rides on the same row to save
                vertical space. */}
            <div className="mb-1 flex items-baseline gap-3">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                {effectiveTranslation.label}
              </span>
              {effectiveTranslation.hasStrongs && (
                <span className="shrink-0 text-[10px] italic text-[var(--color-ink-2)]/70">
                  with BDB-Thayer&apos;s
                </span>
              )}
              {effectiveTranslation.id !== preferredTranslation.id && (
                <span
                  className="shrink-0 text-[10px] italic text-[var(--color-ink-2)]/70"
                  title={`Falling back to ${effectiveTranslation.label} — ${preferredTranslation.label} doesn't cover ${book.testament}.`}
                >
                  (fallback from {preferredTranslation.label})
                </span>
              )}
              {chapterAttribution && (
                <span
                  className="ml-auto min-w-0 truncate text-right text-[10px] font-light leading-snug text-[var(--color-ink-2)]/45"
                  title={chapterAttribution}
                >
                  {chapterAttribution}
                </span>
              )}
            </div>
            <div className="flex items-stretch gap-1.5">
              <VerseArrow
                direction="prev"
                label={prevTarget ? formatNavLabel(prevTarget) : null}
                disabled={!prevTarget}
                onClick={() => prevTarget && handleNavigate(prevTarget)}
              />
              <VerseArrow
                direction="next"
                label={nextTarget ? formatNavLabel(nextTarget) : null}
                disabled={!nextTarget}
                onClick={() => nextTarget && handleNavigate(nextTarget)}
              />
              <VerseTimeIndicator
                activeVerseKey={verseKey({ bookId, chapter, verse })}
                onJump={(target) => handleNavigate(target)}
              />
              <div className="min-w-0 flex-1">
                {effectiveTranslation.hasStrongs ? (
                  <Interlinear
                    verse={currentVerse}
                    studies={studies}
                    isHebrew={book.testament === "OT"}
                    verseDir={effectiveTranslation.dir}
                    onTokenEnter={onTokenEnter}
                    onTokenLeave={onTokenLeave}
                    onTokenClick={onTokenClick}
                    activeStrong={popover?.strong ?? null}
                  />
                ) : (
                  <PlainVerse
                    verse={currentVerse}
                    dir={effectiveTranslation.dir}
                    original={effectiveTranslation.original}
                  />
                )}
              </div>
            </div>
          </>
        )}
        {/* KJV parallel — full Strong's interlinear shown when the user's
            selected translation doesn't carry Strong's tags, so the word
            study is always one row away. */}
        {!chapterLoading &&
          !chapterError &&
          showKjvParallel &&
          kjvCurrentVerse && (
            <div className="mt-3 border-t border-[var(--color-rule)]/60 pt-2">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                  KJV
                </span>
                <span className="text-[10px] italic text-[var(--color-ink-2)]/70">
                  with BDB-Thayer&apos;s
                </span>
              </div>
              <Interlinear
                verse={kjvCurrentVerse}
                studies={studies}
                isHebrew={book.testament === "OT"}
                verseDir="ltr"
                onTokenEnter={onTokenEnter}
                onTokenLeave={onTokenLeave}
                onTokenClick={onTokenClick}
                activeStrong={popover?.strong ?? null}
              />
            </div>
          )}

        {xrefs.length > 0 && (
          <div className="mt-2 border-t border-[var(--color-rule)]/60 pt-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
              Cross-references
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {xrefs.map((x, i) => (
                <li key={`${x.toLabel}-${i}`}>
                  <button
                    type="button"
                    onClick={() =>
                      handleNavigate({
                        bookId: x.to.book,
                        chapter: x.to.chapter,
                        verse: x.to.verseStart ?? 1,
                      })
                    }
                    title={`${CATEGORY_LABEL[x.category] ?? x.category} — ${x.note}`}
                    className="rounded-full border border-[var(--color-rule)] bg-white/70 px-2 py-0.5 text-[11px] text-[var(--color-ink)] hover:bg-black/5"
                  >
                    <span className="font-serif">{x.toLabel}</span>
                    <span className="ml-1 text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]">
                      {CATEGORY_LABEL[x.category] ?? x.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {popover && popoverStudy && (
        <WordStudyPopover
          rect={popover.rect}
          study={popoverStudy}
          pinned={popover.pinned}
          onClose={() => setPopover(null)}
          onOpenDeepDive={openDeepDive}
        />
      )}

      <WordDeepDiveDrawer
        strong={deepDiveStrong}
        onClose={closeDeepDive}
        onOpenRelated={openDeepDive}
      />

      <BibleVersionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        groups={availableTranslationGroups}
        currentId={preferredTranslation.id}
        isConfigured={isTranslationConfigured}
        onSelect={handleTranslationChange}
      />
    </section>
  );
}

// ─── Prev/next verse arrow ────────────────────────────────────────────────

function formatNavLabel(t: BibleNavTarget): string {
  const b = BIBLE_BOOKS.find((x) => x.id === t.bookId);
  const name = b?.abbr ?? t.bookId;
  const verse = t.verse >= 999 ? "" : `:${t.verse}`;
  return `${name} ${t.chapter}${verse}`;
}

function VerseArrow({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  /** Human-readable preview of where this arrow would go, used in tooltip. */
  label: string | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  const title = disabled
    ? isPrev
      ? "Already at the first verse"
      : "Already at the last verse"
    : `${isPrev ? "Previous" : "Next"} verse${label ? ` — ${label}` : ""} (${isPrev ? "←" : "→"})`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={isPrev ? "Previous verse" : "Next verse"}
      className={cn(
        "flex shrink-0 items-center justify-center self-stretch rounded-md border border-[var(--color-rule)] bg-white px-2 text-[var(--color-ink-2)] transition-colors",
        disabled
          ? "cursor-not-allowed opacity-30"
          : "hover:border-[var(--color-ink-2)]/50 hover:bg-black/5 hover:text-[var(--color-ink)]",
      )}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        {isPrev ? (
          <polyline points="12,5 6,10 12,15" />
        ) : (
          <polyline points="8,5 14,10 8,15" />
        )}
      </svg>
    </button>
  );
}

// ─── Verse study-time indicator ────────────────────────────────────────────
// Sits next to the verse-nav arrows and shows a live "⏱ m:ss" count of
// active study time on the current verse. Clicking it opens a popover
// listing every verse the user has studied, sorted newest-first, with
// totals. Clicking a row jumps to that verse.

function VerseTimeIndicator({
  activeVerseKey,
  onJump,
}: {
  activeVerseKey: string;
  onJump(target: BibleNavTarget): void;
}) {
  const [snap, setSnap] = useState<TrackerSnapshot>({
    current: null,
    totals: {},
  });
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Subscribe for live ticks. The tracker fires on every 1 Hz heartbeat
  // while the user is active on a verse, plus on start/end of sessions.
  useEffect(() => {
    return subscribeVerseSessions((s) => setSnap(s));
  }, []);

  // Dismiss popover on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Live active-ms for the currently-viewed verse. Includes the in-flight
  // session (not yet flushed) plus any prior rollup on this verse.
  const liveMs = (() => {
    const rolled = snap.totals[activeVerseKey]?.totalMs ?? 0;
    const live =
      snap.current?.verseKey === activeVerseKey ? snap.current.activeMs : 0;
    return rolled + live;
  })();

  const hasAny = Object.keys(snap.totals).length > 0 || liveMs > 0;
  const display = liveMs > 0 ? formatDuration(liveMs) : "0:00";
  const isTicking =
    snap.current?.verseKey === activeVerseKey && snap.current.activeMs > 0;

  return (
    <div className="relative shrink-0 self-stretch">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={
          hasAny
            ? "Study time on this verse — click for history"
            : "No study time recorded yet — click to track as you read"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-full items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium tabular-nums transition-colors",
          isTicking
            ? "border-emerald-600/50 bg-emerald-50/60 text-emerald-900"
            : "border-[var(--color-rule)] bg-white text-[var(--color-ink-2)] hover:border-[var(--color-ink-2)]/50 hover:text-[var(--color-ink)]",
        )}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("h-3.5 w-3.5", isTicking && "animate-pulse")}
          aria-hidden
        >
          <circle cx="10" cy="11" r="6" />
          <path d="M10 7.5v3.5l2 1.5" />
          <path d="M8 3h4" />
        </svg>
        <span>{display}</span>
      </button>
      {open && (
        <VerseTimePanel
          panelRef={panelRef}
          activeVerseKey={activeVerseKey}
          onJump={(t) => {
            setOpen(false);
            onJump(t);
          }}
        />
      )}
    </div>
  );
}

function VerseTimePanel({
  panelRef,
  activeVerseKey,
  onJump,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  activeVerseKey: string;
  onJump(target: BibleNavTarget): void;
}) {
  // Re-read on every tick so the row for the live verse keeps counting
  // up while the panel is open.
  const [rows, setRows] = useState<VerseStats[]>(() => getAllVerseStats());
  useEffect(() => {
    return subscribeVerseSessions(() => setRows(getAllVerseStats()));
  }, []);

  const totalMs = rows.reduce((sum, r) => sum + r.totalMs, 0);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Verse study history"
      className="absolute right-0 top-full z-40 mt-1 w-72 rounded-lg border border-[var(--color-rule)] bg-white p-2 shadow-xl"
    >
      <div className="flex items-baseline justify-between border-b border-[var(--color-rule)]/60 pb-1 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
        <span>Verses studied</span>
        {totalMs > 0 && (
          <span className="tabular-nums text-[var(--color-ink-2)]/80">
            {formatDuration(totalMs)} total
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-3 text-center text-[11px] italic text-[var(--color-ink-2)]">
          Land on a verse and the timer starts. Totals show up here.
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto py-1">
          {rows.map((r) => {
            const key = `${r.bookId}:${r.chapter}:${r.verse}`;
            const book = BIBLE_BOOKS.find((b) => b.id === r.bookId);
            const label = `${book?.abbr ?? r.bookId} ${r.chapter}:${r.verse}`;
            const isActive = key === activeVerseKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() =>
                    onJump({
                      bookId: r.bookId,
                      chapter: r.chapter,
                      verse: r.verse,
                    })
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] hover:bg-black/5",
                    isActive && "bg-emerald-50/60",
                  )}
                >
                  <span className="flex-1 truncate font-serif text-[13px] text-[var(--color-ink)]">
                    {label}
                  </span>
                  {r.sessionCount > 1 && (
                    <span className="text-[9.5px] uppercase tracking-widest text-[var(--color-ink-2)]/70">
                      ×{r.sessionCount}
                    </span>
                  )}
                  <VerseTimeBar ms={r.totalMs} max={rows[0]?.totalMs ?? 1} />
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-ink-2)]">
                    {formatDuration(r.totalMs)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function VerseTimeBar({ ms, max }: { ms: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((ms / max) * 100)) : 0;
  return (
    <span
      aria-hidden
      className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--color-rule)]/50"
    >
      <span
        className="block h-full rounded-full bg-emerald-700/70"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

// ─── Plain verse (used when the translation has no Strong's tags) ────────

function PlainVerse({
  verse,
  dir,
  original,
}: {
  verse: ParsedVerse;
  dir: "ltr" | "rtl";
  /** True when the verse text IS the Hebrew/Greek original. */
  original: boolean;
}) {
  return (
    <p
      dir={dir}
      className={cn(
        "font-serif text-[19px] leading-relaxed text-[var(--color-ink)]",
        original && dir === "rtl" && "text-[22px] leading-loose",
        original && dir === "ltr" && "text-[20px]",
      )}
    >
      {verse.plain}
    </p>
  );
}

// ─── Interlinear row ──────────────────────────────────────────────────────

function Interlinear({
  verse,
  studies,
  isHebrew,
  verseDir,
  onTokenEnter,
  onTokenLeave,
  onTokenClick,
  activeStrong,
}: {
  verse: ParsedVerse;
  studies: Record<string, WordStudy>;
  isHebrew: boolean;
  /**
   * Reading direction of the verse text itself. This is "rtl" when the
   * translation IS the Hebrew original (WLCa), and "ltr" otherwise — even
   * for English OT translations whose lemma row is Hebrew (the lemma row
   * sets its own per-token `dir`).
   */
  verseDir: "ltr" | "rtl";
  onTokenEnter(strong: string, el: HTMLElement): void;
  onTokenLeave(): void;
  onTokenClick(strong: string, el: HTMLElement): void;
  activeStrong: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Track whether the user actually dragged (vs clicked) so we can suppress
  // the click on the underlying token button at drag-end.
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startScroll: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Ignore non-primary buttons; let real button clicks through untouched.
    if (e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !drag.active || !el) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      // Capture the pointer once we know it's a drag so subsequent moves
      // keep flowing to us even if the cursor leaves the row.
      try {
        el.setPointerCapture(drag.pointerId);
      } catch {
        // Some browsers throw if the pointer is already captured elsewhere.
      }
      el.style.cursor = "grabbing";
    }
    if (drag.moved) {
      el.scrollLeft = drag.startScroll - dx;
      e.preventDefault();
    }
  }, []);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !el) return;
    if (drag.moved) {
      // Swallow the click that would otherwise fire on the underlying token
      // button after a drag-pan gesture.
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        el.removeEventListener("click", swallow, true);
      };
      el.addEventListener("click", swallow, true);
    }
    try {
      el.releasePointerCapture(drag.pointerId);
    } catch {
      // ignore
    }
    el.style.cursor = "";
    dragRef.current = null;
    void e;
  }, []);

  return (
    <div
      ref={scrollRef}
      // Always render the study verse on a single line; scroll horizontally
      // when the tokens overflow the available width. Scrollbar is hidden
      // (.no-scrollbar) — users pan by click-and-drag instead.
      dir={verseDir}
      className="no-scrollbar flex cursor-grab flex-nowrap items-stretch gap-x-3 overflow-x-auto pt-1 pb-2 select-none touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      {verse.tokens.map((tok, i) => {
        const study = tok.strong ? studies[tok.strong] : null;
        const active = !!tok.strong && tok.strong === activeStrong;
        const interactive = !!tok.strong;
        return (
          <button
            key={i}
            type="button"
            data-bible-token
            disabled={!interactive}
            onMouseEnter={
              interactive
                ? (e) =>
                    onTokenEnter(tok.strong!, e.currentTarget as HTMLElement)
                : undefined
            }
            onMouseLeave={interactive ? onTokenLeave : undefined}
            onFocus={
              interactive
                ? (e) =>
                    onTokenEnter(tok.strong!, e.currentTarget as HTMLElement)
                : undefined
            }
            onBlur={interactive ? onTokenLeave : undefined}
            onClick={
              interactive
                ? (e) =>
                    onTokenClick(tok.strong!, e.currentTarget as HTMLElement)
                : undefined
            }
            className={cn(
              "group flex min-w-[2.5rem] shrink-0 flex-col items-center rounded-md px-1.5 py-1 text-center transition-colors",
              interactive && "hover:bg-black/5 focus:bg-black/5 focus:outline-none",
              active && "bg-[var(--color-ink)]/5 ring-1 ring-[var(--color-ink)]/30",
              !interactive && "cursor-default",
            )}
            aria-label={
              tok.strong
                ? `${tok.text || "(implied)"} — ${tok.strong}`
                : tok.text
            }
          >
            {/* English line */}
            <span className="font-serif text-[15px] leading-tight text-[var(--color-ink)]">
              {tok.text || (
                <span className="opacity-30">·</span>
              )}
            </span>
            {/* Original-language lemma */}
            <span
              className={cn(
                "mt-0.5 leading-tight",
                isHebrew
                  ? "font-serif text-[17px]"
                  : "font-serif text-[14px] italic",
                study ? "text-[var(--color-ink)]" : "text-[var(--color-ink-2)]/40",
              )}
              dir={isHebrew ? "rtl" : "ltr"}
            >
              {study?.lexeme || (tok.strong ? "…" : "")}
            </span>
            {/* Short word study */}
            <span className="mt-0.5 max-w-[10rem] text-[10px] uppercase tracking-wide text-[var(--color-ink-2)]">
              {study?.shortGloss ?? (tok.strong ? "…" : "")}
            </span>
            {/* Strong's number, very small */}
            {tok.strong && (
              <span className="text-[9px] text-[var(--color-ink-2)]/60">
                {tok.strong}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Word study popover ───────────────────────────────────────────────────

function WordStudyPopover({
  rect,
  study,
  pinned,
  onClose,
  onOpenDeepDive,
}: {
  rect: DOMRect;
  study: WordStudy;
  pinned: boolean;
  onClose(): void;
  /** Opens the AI Assistant deep-dive drawer for this Strong's. */
  onOpenDeepDive(strong: string): void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Auto-computed viewport-clamped position. Starts below the token and
  // flips above / scrolls internally if content outgrows the viewport.
  const [coords, setCoords] = useState<{ left: number; top: number }>({
    left: rect.left,
    top: rect.bottom + 6,
  });
  // Null until the user drags the header. Once set, `coords` is ignored
  // and we trust the user's chosen position (still clamped to viewport).
  const [userCoords, setUserCoords] = useState<
    { left: number; top: number } | null
  >(null);
  // The async `PeriodUsageSection` grows the popover after mount; this
  // state lets the viewport-height calc cap the scrollable region.
  const [maxBodyH, setMaxBodyH] = useState<number>(() =>
    Math.max(200, window.innerHeight - 64),
  );
  // Reset to auto-position when the target token changes (new word click).
  useEffect(() => {
    setUserCoords(null);
  }, [rect]);

  // Clamp to viewport. Re-runs whenever the popover's own size changes
  // (async period-usage load, deep-dive button appearing on pin) or when
  // the window resizes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const PAD = 8;

    const recompute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const W = el.offsetWidth;
      const H = el.offsetHeight;

      // Cap the scrollable body region so the popover never exceeds the
      // viewport. 64px accounts for header + footer + padding.
      setMaxBodyH(Math.max(160, vh - 96));

      if (userCoords) {
        // Only clamp what the user chose — don't re-center on content growth.
        setCoords({
          left: Math.max(PAD, Math.min(userCoords.left, vw - W - PAD)),
          top: Math.max(PAD, Math.min(userCoords.top, vh - H - PAD)),
        });
        return;
      }

      let left = rect.left + rect.width / 2 - W / 2;
      left = Math.max(PAD, Math.min(left, vw - W - PAD));

      const spaceBelow = vh - rect.bottom - PAD - 6;
      const spaceAbove = rect.top - PAD - 6;
      let top: number;
      if (H <= spaceBelow) {
        top = rect.bottom + 6;
      } else if (H <= spaceAbove) {
        top = rect.top - H - 6;
      } else {
        // Doesn't fit either way at full height — place in the side with
        // more room and let the internal scroll region clip; clamp top.
        top =
          spaceBelow >= spaceAbove
            ? Math.min(rect.bottom + 6, vh - H - PAD)
            : Math.max(PAD, rect.top - H - 6);
        top = Math.max(PAD, Math.min(top, vh - H - PAD));
      }
      setCoords({ left, top });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [rect, userCoords]);

  // Drag from the header — uses pointer capture so the drag keeps working
  // even if the cursor leaves the popover mid-drag. Ignores drags that
  // originate on the close button.
  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pinned) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = el.getBoundingClientRect().left;
    const startTop = el.getBoundingClientRect().top;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const nextLeft = startLeft + (ev.clientX - startX);
      const nextTop = startTop + (ev.clientY - startY);
      setUserCoords({ left: nextLeft, top: nextTop });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={ref}
      data-bible-popover
      role="dialog"
      aria-label={`Word study: ${study.lexeme}`}
      className="fixed z-50 flex max-w-md flex-col rounded-lg border border-[var(--color-rule)] bg-white text-[12px] leading-snug text-[var(--color-ink)] shadow-xl"
      style={{
        left: coords.left,
        top: coords.top,
        maxHeight: `calc(100vh - 16px)`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex shrink-0 items-baseline gap-2 border-b border-[var(--color-rule)]/70 px-3 pb-1 pt-2 ${
          pinned ? "cursor-grab active:cursor-grabbing select-none" : ""
        }`}
        onPointerDown={onHeaderPointerDown}
        title={pinned ? "Drag to reposition" : undefined}
      >
        <span className="font-serif text-base">{study.lexeme}</span>
        <span className="text-[11px] italic text-[var(--color-ink-2)]">
          {study.transliteration}
        </span>
        <span className="text-[10px] text-[var(--color-ink-2)]">
          {study.pronunciation}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
          {study.strong}
        </span>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded px-1 text-[var(--color-ink-2)] hover:bg-black/5"
            aria-label="Close word study"
          >
            ×
          </button>
        )}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        style={{ maxHeight: maxBodyH }}
      >
        <div
          className="prose-bible text-[12px]"
          // The dictionary HTML is from a single, trusted upstream source
          // (bolls.life BDBT). It contains formatting tags only — no scripts —
          // and is sanitized of <S> footnotes by our server before display.
          dangerouslySetInnerHTML={{ __html: sanitizeDefHtml(study.detailHtml) }}
        />
        {pinned && <PeriodUsageSection study={study} />}
      </div>

      {pinned && (
        <div className="flex shrink-0 justify-end border-t border-[var(--color-rule)]/60 px-3 py-1.5">
          <button
            type="button"
            onClick={() => onOpenDeepDive(study.strong)}
            className="rounded border border-[var(--color-rule)] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--color-ink)] hover:border-[var(--color-ink-2)]/50 hover:bg-black/5"
            title="Open AI Assistant deep dive"
          >
            Deep study →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── "In its time" period-usage section ───────────────────────────────────
//
// Only mounted when the popover is pinned (i.e. the user clicked a word),
// so we don't fan out LLM calls on casual hovers. The server-side route
// caches results per Strong's number, so subsequent pins of the same word
// are instant and free.

function PeriodUsageSection({ study }: { study: WordStudy }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; usage: WordUsage }
    | { kind: "disabled" }
    | { kind: "error"; message: string }
    | { kind: "empty" }
  >({ kind: "loading" });

  useEffect(() => {
    setState({ kind: "loading" });
    const ctl = new AbortController();
    const qs = new URLSearchParams({ strong: study.strong });
    fetch(`/api/bible/usage?${qs.toString()}`, { signal: ctl.signal })
      .then(async (r) => (await r.json()) as UsageResponse)
      .then((data) => {
        if (data.configured === false) return setState({ kind: "disabled" });
        if (data.error) return setState({ kind: "error", message: data.error });
        if (!data.usage) return setState({ kind: "empty" });
        // Truth-rules contract: if the model refused, we surface "empty"
        // rather than showing any prose — refusal means we couldn't
        // corroborate the content with real sources.
        if (data.usage.refusalReason) return setState({ kind: "empty" });
        setState({ kind: "ready", usage: data.usage });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "unknown error",
        });
      });
    return () => ctl.abort();
  }, [study.strong]);

  if (state.kind === "disabled") return null;

  return (
    <div className="mt-3 border-t border-[var(--color-rule)]/70 pt-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
          In its time
        </span>
        {state.kind === "ready" && (
          <span className="text-[10px] italic text-[var(--color-ink-2)]/80">
            {state.usage.period}
          </span>
        )}
      </div>
      <div className="mt-1 text-[12px] leading-snug text-[var(--color-ink)]">
        {state.kind === "loading" && (
          <span className="text-[var(--color-ink-2)]">
            Consulting period usage…
          </span>
        )}
        {state.kind === "ready" && (
          <>
            <p>{state.usage.commonUsage}</p>
            {state.usage.connotations.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] text-[var(--color-ink)]/90">
                {state.usage.connotations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
            {state.usage.uncertainty ? (
              <UncertaintyNote note={state.usage.uncertainty} />
            ) : null}
            {state.usage.sources.length > 0 && (
              <SourcesList sources={state.usage.sources} />
            )}
          </>
        )}
        {state.kind === "empty" && (
          <span className="text-[var(--color-ink-2)]">
            No period notes available for this word.
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-rose-700">
            Couldn&apos;t load period usage: {state.message}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Cross-reference sources list ─────────────────────────────────────────
//
// The truth-rules layer (`lib/llm/truthRules.ts`) guarantees that every
// LLM response carries a normalized `sources` array with allowlisted
// URLs only. We just render it — no sanitization needed here.

function UncertaintyNote({ note }: { note: string }) {
  return (
    <p
      className="mt-1.5 rounded-sm border border-amber-600/40 bg-amber-50/60 px-1.5 py-1 text-[10.5px] italic leading-snug text-amber-900"
      title="Scholarly uncertainty disclosed by the model per §7 of the truth rules."
    >
      <span className="mr-1 font-semibold not-italic uppercase tracking-wider text-[9px]">
        Caveat
      </span>
      {note}
    </p>
  );
}

function SourcesList({ sources }: { sources: WordUsageSource[] }) {
  return (
    <div className="mt-2 border-t border-[var(--color-rule)]/40 pt-1.5">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]/80">
        <span>Cross-references</span>
        <span
          className="rounded-sm border border-emerald-600/50 bg-emerald-50/60 px-1 py-[1px] text-[8.5px] tracking-wider text-emerald-900"
          title="Every citation matches a work on the trusted scholarly allowlist (lib/llm/trustedSources.ts) and the draft was audited against the retrieved BDB/Thayer entry."
        >
          Audited
        </span>
      </div>
      <ul className="mt-1 space-y-0.5 text-[10.5px] leading-snug text-[var(--color-ink-2)]">
        {sources.map((s, i) => {
          const work = matchTrustedWork(s.citation);
          const title = work
            ? `${work.title} — ${work.editors}${work.year ? `, ${work.year}` : ""}`
            : s.type;
          const body = (
            <>
              {work ? (
                <span className="mr-1 rounded-sm border border-[var(--color-rule)]/60 bg-[var(--color-surface)]/60 px-1 py-[1px] text-[8.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-2)]">
                  {work.abbrev}
                </span>
              ) : null}
              <span>
                {s.citation}
                {s.locus ? ` — ${s.locus}` : ""}
              </span>
            </>
          );
          return (
            <li key={i} className="flex items-start gap-0">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline gap-0 underline decoration-dotted underline-offset-2 hover:text-[var(--color-ink)]"
                  title={title}
                >
                  {body}
                </a>
              ) : (
                <span className="inline-flex items-baseline gap-0" title={title}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Light sanitizer for the BDB / Thayer's HTML returned by bolls.life. We
 * neutralize their `<a href=S:G3588>` cross-reference links (which aren't real
 * URLs) and drop any unexpected tags like `<script>` or `<iframe>`.
 */
function sanitizeDefHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<a\s+href=S:[^>]*>([^<]*)<\/a>/gi, "<em>$1</em>")
    .replace(/<a\s[^>]*>([^<]*)<\/a>/gi, "$1")
    .replace(/on\w+="[^"]*"/gi, "");
}
