"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import { verseCount } from "@/lib/bible/versesPerChapter";
import { fetchChapterFromApi } from "@/lib/bible/chapterApiClient";
import {
  DEFAULT_TRANSLATION_ID,
  getTranslation,
  groupTranslations,
  translationCovers,
  translationsFor,
} from "@/lib/bible/translations";
import { readLastView, writeLastView } from "@/lib/bible/lastView";
import { XREF_CATEGORY_LABEL } from "@/lib/bible/xrefCategories";
import { matchTrustedWork } from "@/lib/llm/trustedSources";
import { useGridStore } from "@/lib/grid/state";
import {
  endSession as endVerseSession,
  startSession as startVerseSession,
} from "@/lib/study/verseSessions";
import { BibleSearchBar, type BibleNavTarget } from "./BibleSearchBar";
import { BibleVersionPicker } from "./BibleVersionPicker";
import { WordDeepDiveDrawer } from "./WordDeepDiveDrawer";
import { useBibleHeaderSlotTarget } from "./bibleHeaderSlot";
import { BibleReaderResizeHandle } from "./BibleReaderResizeHandle";
import { StrongResizeHandle } from "./StrongResizeHandle";
import {
  BIBLE_READER_CONTEXT_MAX_HEIGHT_PX,
  BIBLE_READER_KJV_LABEL_PX,
  BIBLE_READER_META_HEIGHT_PX,
  fixedHeightStyle,
  kjvInterlinearHeightPx,
} from "@/lib/grid/bibleReaderLayout";
import { useBibleReaderPanelHeights } from "@/lib/grid/useBibleReaderPanelHeights";
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
interface StrongsOccurrenceVerse {
  book: string;
  chapter: number;
  verse: number;
  label: string;
}
interface StrongsResponse {
  strong: string;
  count: number;
  verses: StrongsOccurrenceVerse[];
  error?: string;
}
interface StrongsXRefRow {
  to: {
    book: string;
    chapter: number;
    verseStart?: number;
    verseEnd?: number;
  };
  toLabel: string;
  category:
    | "ot-in-nt"
    | "synoptic-parallel"
    | "thematic-chain"
    | "messianic"
    | "narrative-parallel";
  note: string;
  fromVerse: { book: string; chapter: number; verse: number };
  fromVerseLabel: string;
}
interface StrongsXRefsResponse {
  strong: string;
  count: number;
  xrefs: StrongsXRefRow[];
  error?: string;
}
// ─── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_BOOK = "Jhn";
const DEFAULT_CHAPTER = 3;
const DEFAULT_VERSE = 16;

const RECENTS_STORAGE_KEY = "bibliteracy:bible:recents";
const RECENTS_MAX = 8;
const TRANSLATION_STORAGE_KEY = "bibliteracy:bible:translation";
const CONTEXT_STORAGE_KEY = "bibliteracy:bible:contextCount";
// Cap so a stray big number can't render the whole chapter in one scroll.
const CONTEXT_MAX = 20;

// ─── Component ────────────────────────────────────────────────────────────

export function BibleReader() {
  const setCurrentBibleRef = useGridStore((s) => s.setCurrentBibleRef);
  const [bookId, setBookId] = useState<string>(DEFAULT_BOOK);
  const [chapter, setChapter] = useState<number>(DEFAULT_CHAPTER);
  const [verse, setVerse] = useState<number>(DEFAULT_VERSE);
  // Defer persisting until we've hydrated from localStorage so we don't
  // overwrite a saved position with the John 3:16 default on first mount.
  const [positionReady, setPositionReady] = useState(false);
  useEffect(() => {
    const stored = readLastView();
    if (stored) {
      setBookId(stored.bookId);
      setChapter(stored.chapter);
      setVerse(stored.verse);
    }
    setPositionReady(true);
  }, []);
  useEffect(() => {
    if (!positionReady) return;
    writeLastView({ bookId, chapter, verse });
  }, [bookId, chapter, verse, positionReady]);

  const book = useMemo(
    () => BIBLE_BOOKS.find((b) => b.id === bookId) ?? BIBLE_BOOKS[0],
    [bookId],
  );

  // ── Translation (persisted in localStorage) ────────────────────────────
  // The picker exposes every translation served by bolls.life (see
  // lib/bible/translations.ts). Original-language texts and KJV render as
  // a Strong's interlinear; every other English translation renders as a
  // plain paragraph with a KJV Strong's row underneath for word study.
  // When the user navigates to a book in a testament the current translation
  // doesn't cover (e.g. WLCa is OT-only and they jump to John), we
  // transparently swap to the default for that session without overwriting
  // their stored preference.
  const [translationId, setTranslationId] = useState<string>(
    DEFAULT_TRANSLATION_ID,
  );
  const setBibleTranslationId = useGridStore((s) => s.setBibleTranslationId);
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
    setBibleTranslationId(id);
    try {
      window.localStorage.setItem(TRANSLATION_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, [setBibleTranslationId]);
  useEffect(() => {
    setBibleTranslationId(translationId);
  }, [translationId, setBibleTranslationId]);
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
    setCurrentBibleRef({
      book: target.bookId,
      chapter: target.chapter,
      verseStart: target.verse,
    });
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
  }, [setCurrentBibleRef]);

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
    fetchChapterFromApi(
      bookId,
      chapter,
      effectiveTranslation.id,
      ctl.signal,
    )
      .then((data) => {
        if (aborted) return;
        if (data.error) {
          setChapterError(data.error);
          if (data.configMissing) setChapterConfigMissing(data.configMissing);
          return;
        }
        const verses = data.verses;
        if (!verses?.length) {
          setChapterError("No verses returned for this chapter.");
          return;
        }
        setChapterData(verses);
        setChapterAttribution(data.attribution ?? null);
        // Snap verse into range.
        if (verse > verses.length) setVerse(verses.length || 1);
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

  // ── Leading-context verses ────────────────────────────────────────────
  // The user can ask to see N verses BEFORE the active verse so the
  // interlinear sits in its passage context. We stay inside the
  // currently-loaded chapter (no extra fetches) and render them in a
  // smaller font above the active verse.
  const [contextCount, setContextCount] = useState<number>(0);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
      if (stored == null) return;
      const n = Number.parseInt(stored, 10);
      if (Number.isFinite(n) && n >= 0) {
        setContextCount(Math.min(CONTEXT_MAX, n));
      }
    } catch {
      // ignore privacy-mode / quota errors
    }
  }, []);
  const handleContextCountChange = useCallback((next: number) => {
    const clamped = Math.max(
      0,
      Math.min(CONTEXT_MAX, Number.isFinite(next) ? Math.floor(next) : 0),
    );
    setContextCount(clamped);
    try {
      window.localStorage.setItem(CONTEXT_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);
  const contextBefore = useMemo<ParsedVerse[]>(() => {
    if (!chapterData || contextCount === 0) return [];
    return chapterData.filter(
      (v) => v.verse < verse && v.verse >= verse - contextCount,
    );
  }, [chapterData, verse, contextCount]);

  // ── Prev/next verse navigation ────────────────────────────────────────
  // Flow rules: step through verses within a chapter, then across chapters
  // within a book, then across books along the canonical `order` field
  // (which mirrors the BooksLane — TaNaK for OT, traditional NT ordering
  // after Malachi). When we cross a chapter boundary backwards we resolve
  // the previous chapter's last verse from the static KJV verses-per-
  // chapter table so the UI can render the final verse number immediately
  // instead of flashing a placeholder "999" while the chapter fetches.
  // If the user's current translation happens to have fewer verses than
  // KJV for that chapter, the chapter-load effect below still clamps
  // `verse` down to the actual count once the data arrives.
  const prevTarget = useMemo<BibleNavTarget | null>(() => {
    if (verse > 1) return { bookId, chapter, verse: verse - 1 };
    if (chapter > 1) {
      const last = verseCount(bookId, chapter - 1) ?? 999;
      return { bookId, chapter: chapter - 1, verse: last };
    }
    const prevBook = BIBLE_BOOKS.find((b) => b.order === book.order - 1);
    if (prevBook) {
      const last = verseCount(prevBook.id, prevBook.chapters) ?? 999;
      return { bookId: prevBook.id, chapter: prevBook.chapters, verse: last };
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

  // Publish the active verse into shared grid state so the new-dot composer
  // can pre-populate a reference tag without having to thread props through
  // the BooksLane / Lane / Toolbar trees.
  const bibleNavigationSeq = useGridStore((s) => s.bibleNavigationSeq);
  const bibleNavigationTarget = useGridStore((s) => s.bibleNavigationTarget);
  useEffect(() => {
    const verseStart =
      contextCount > 0 ? Math.max(1, verse - contextCount) : verse;
    setCurrentBibleRef({
      book: bookId,
      chapter,
      verseStart,
      verseEnd: verse,
    });
    return () => setCurrentBibleRef(null);
  }, [bookId, chapter, verse, contextCount, setCurrentBibleRef]);

  useEffect(() => {
    if (!bibleNavigationTarget || bibleNavigationSeq === 0) return;
    handleNavigate({
      bookId: bibleNavigationTarget.book,
      chapter: bibleNavigationTarget.chapter,
      verse: bibleNavigationTarget.verseStart ?? 1,
    });
  }, [bibleNavigationSeq, bibleNavigationTarget, handleNavigate]);

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

  // ── Interlinear / parallel policy ─────────────────────────────────────
  // Original-language texts (Hebrew / Greek) and KJV render their primary
  // verse as a Strong's interlinear. Every other English translation
  // renders as a plain paragraph with a KJV Strong's row underneath.
  const renderAsInterlinear =
    effectiveTranslation.hasStrongs &&
    (effectiveTranslation.original || effectiveTranslation.id === "KJV");
  // Always show the KJV Strong's interlinear below the selected translation
  // unless the primary row is already KJV interlinear. Original-language
  // texts keep their Hebrew/Greek interlinear on top and still get the
  // English KJV Strong's row underneath for word study.
  const showKjvParallel =
    !renderAsInterlinear || effectiveTranslation.original;
  const [kjvVerses, setKjvVerses] = useState<ParsedVerse[] | null>(null);
  useEffect(() => {
    if (!showKjvParallel) {
      setKjvVerses(null);
      return;
    }
    let aborted = false;
    const ctl = new AbortController();
    fetchChapterFromApi(bookId, chapter, "KJV", ctl.signal)
      .then((data) => {
        if (aborted || data.error || !data.verses?.length) return;
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
  // When the primary is an original-language interlinear, the popover
  // hangs off its tokens directly; otherwise it hangs off the KJV
  // parallel row below.
  const studyVerse: ParsedVerse | null = renderAsInterlinear
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

  // ── Strong's highlight + popover ──────────────────────────────────────
  // Hover drives xref-band / token styling only. Click opens the word-study
  // popover. Leaving a token (without entering another) locks the highlight.

  const [hoveredStrong, setHoveredStrong] = useState<string | null>(null);
  const pinnedStrong = useGridStore((s) => s.pinnedStrong);
  const setPinnedStrong = useGridStore((s) => s.setPinnedStrong);
  const [popover, setPopover] = useState<{
    strong: string;
    rect: DOMRect;
  } | null>(null);

  const highlightStrong =
    hoveredStrong ?? popover?.strong ?? pinnedStrong ?? null;

  const tokenLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTokenLeaveTimer = useCallback(() => {
    if (tokenLeaveTimer.current) {
      clearTimeout(tokenLeaveTimer.current);
      tokenLeaveTimer.current = null;
    }
  }, []);

  const onTokenEnter = useCallback(
    (strong: string) => {
      clearTokenLeaveTimer();
      setHoveredStrong(strong);
      setPinnedStrong(null);
    },
    [clearTokenLeaveTimer, setPinnedStrong],
  );
  const onTokenLeave = useCallback(() => {
    clearTokenLeaveTimer();
    tokenLeaveTimer.current = setTimeout(() => {
      setHoveredStrong((cur) => {
        if (cur) setPinnedStrong(cur);
        return null;
      });
    }, 160);
  }, [clearTokenLeaveTimer, setPinnedStrong]);
  const onTokenClick = useCallback(
    (strong: string, el: HTMLElement) => {
      clearTokenLeaveTimer();
      setPinnedStrong(strong);
      if (popover?.strong === strong) {
        setPopover(null);
        setHoveredStrong(strong);
        return;
      }
      setHoveredStrong(null);
      setPopover({ strong, rect: el.getBoundingClientRect() });
    },
    [clearTokenLeaveTimer, popover, setPinnedStrong],
  );

  // Close popover when user clicks outside it (highlight stays locked).
  useEffect(() => {
    if (!popover) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-bible-popover]")) return;
      if (t.closest("[data-bible-token]")) return;
      setPopover(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [popover]);

  const setHighlightStrong = useGridStore((s) => s.setHighlightStrong);
  useEffect(() => {
    setHighlightStrong(highlightStrong);
    return () => setHighlightStrong(null);
  }, [highlightStrong, setHighlightStrong]);

  useEffect(() => {
    setHoveredStrong(null);
    setPopover(null);
  }, [bookId, chapter, verse]);

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

  const {
    passageHeight,
    kjvHeight,
    sectionHeightPx,
    resizePassage,
    resizeKjv,
  } = useBibleReaderPanelHeights(showKjvParallel);

  const kjvTrackHeightPx = kjvInterlinearHeightPx(kjvHeight);

  // ─── Render ────────────────────────────────────────────────────────────

  // The verse search + version picker render up in the global TopNav via a
  // React portal (see `bibleHeaderSlot.tsx`). `headerSlot` is null on the
  // very first render (the slot ref hasn't committed yet) but populates
  // synchronously on mount, which is fine — the portal simply appears on
  // the second paint.
  const headerSlot = useBibleHeaderSlotTarget();
  const headerControls = (
    <>
      {/* Fixed-width wrapper so the version picker can sit directly to the
          right of the search bar instead of being pushed to the far edge of
          the header slot. The width matches the search bar's own internal
          max-width. */}
      <div className="flex w-[18.9rem] shrink-0 items-center">
        <BibleSearchBar
          current={{ bookId, chapter, verse }}
          onNavigate={handleNavigate}
          recents={recents}
        />
      </div>

      {/* Translation picker — click or press ⌘D to open the searchable
          modal. The button itself shows the active selection so users
          always see what they're reading. Sits immediately to the right of
          the verse-search bar so the two reading controls travel together. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        title={`${preferredTranslation.fullName} — search translations (⌘D)`}
        aria-label={`Translation: ${preferredTranslation.label}. Open picker.`}
        aria-haspopup="dialog"
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-rule)] bg-white pl-2 pr-1 text-[11px] text-[var(--color-ink)] hover:border-[var(--color-ink-2)]/50"
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

      {/* Prev / next verse arrows. Moved up from the verse row so the primary
          reading navigation (search → version → step through verses) lives
          together in one horizontal control strip. */}
      <div className="flex shrink-0 items-center gap-1">
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
      </div>
    </>
  );

  return (
    <section
      className="shrink-0 border-b border-[var(--color-rule)] bg-[var(--color-paper)]"
      style={fixedHeightStyle(sectionHeightPx)}
      aria-label="Bible reading"
    >
      {headerSlot && createPortal(headerControls, headerSlot)}

      <div
        className="relative flex flex-col"
        style={fixedHeightStyle(passageHeight)}
      >
        <div className="relative flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3">
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
          <div
            className="pointer-events-none absolute inset-0 z-[1] animate-pulse rounded-md bg-[var(--color-paper-2)]/50"
            aria-hidden
          />
        )}
        {!chapterError && (
          <>
            <div
              className="flex items-baseline gap-3 overflow-hidden"
              style={fixedHeightStyle(BIBLE_READER_META_HEIGHT_PX)}
            >
              {currentVerse ? (
                <>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                    {effectiveTranslation.label}
                  </span>
                  <span className="shrink-0 font-serif text-[12px] text-[var(--color-ink)]">
                    {book.name} {chapter}:{verse}
                  </span>
                  {effectiveTranslation.license === "copyrighted" && (
                    <span
                      className="shrink-0 text-[10px] italic text-amber-700/80"
                      title="This translation is copyrighted and is being served via bolls.life without a publisher license. Verify your usage rights before public deployment."
                    >
                      © unlicensed
                    </span>
                  )}
                  {effectiveTranslation.license ===
                    "licensed-via-publisher-api" && (
                    <span
                      className="shrink-0 text-[10px] italic text-emerald-700/80"
                      title={`Served via the official ${effectiveTranslation.provider.toUpperCase()} API.`}
                    >
                      ⚐ via {effectiveTranslation.provider.toUpperCase()}
                    </span>
                  )}
                  {renderAsInterlinear && (
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
                  <ContextCountInput
                    value={contextCount}
                    max={CONTEXT_MAX}
                    onChange={handleContextCountChange}
                  />
                  {chapterAttribution && (
                    <span
                      className="ml-auto min-w-0 truncate text-right text-[10px] font-light leading-snug text-[var(--color-ink-2)]/45"
                      title={chapterAttribution}
                    >
                      {chapterAttribution}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-[var(--color-ink-2)]">
                  Loading passage…
                </span>
              )}
            </div>

            {currentVerse && contextBefore.length > 0 && (
              <div
                className="shrink-0 overflow-y-auto"
                style={{ maxHeight: BIBLE_READER_CONTEXT_MAX_HEIGHT_PX }}
              >
                <ContextVerses
                  verses={contextBefore}
                  dir={effectiveTranslation.dir}
                  onJump={(v) => handleNavigate({ bookId, chapter, verse: v })}
                />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden">
              {currentVerse ? (
                renderAsInterlinear ? (
                  <Interlinear
                    verse={currentVerse}
                    studies={studies}
                    isHebrew={book.testament === "OT"}
                    verseDir={effectiveTranslation.dir}
                    onTokenEnter={onTokenEnter}
                    onTokenLeave={onTokenLeave}
                    onTokenClick={onTokenClick}
                    activeStrong={highlightStrong}
                  />
                ) : (
                  <PlainVerse
                    verse={currentVerse}
                    dir={effectiveTranslation.dir}
                    original={effectiveTranslation.original}
                  />
                )
              ) : (
                <div
                  className="h-full rounded bg-[var(--color-paper-2)]/40"
                  aria-hidden
                />
              )}
            </div>
          </>
        )}
        </div>
        <BibleReaderResizeHandle
          label="Resize translation panel"
          onResize={resizePassage}
        />
      </div>

      {showKjvParallel && !chapterError && (
        <div
          className="relative flex flex-col border-t border-[var(--color-rule)]/60"
          style={fixedHeightStyle(kjvHeight)}
        >
          <div className="relative flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3">
            {chapterLoading && (
              <div
                className="pointer-events-none absolute inset-0 z-[1] animate-pulse rounded-md bg-[var(--color-paper-2)]/50"
                aria-hidden
              />
            )}
            <div
              className="mb-1 flex shrink-0 items-baseline gap-2"
              style={fixedHeightStyle(BIBLE_READER_KJV_LABEL_PX)}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
                KJV
              </span>
              <span className="text-[10px] italic text-[var(--color-ink-2)]/70">
                with BDB-Thayer&apos;s
              </span>
            </div>
            <div
              className="min-h-0 overflow-hidden"
              style={fixedHeightStyle(kjvTrackHeightPx)}
            >
              {kjvCurrentVerse ? (
                <Interlinear
                  verse={kjvCurrentVerse}
                  studies={studies}
                  isHebrew={book.testament === "OT"}
                  verseDir="ltr"
                  onTokenEnter={onTokenEnter}
                  onTokenLeave={onTokenLeave}
                  onTokenClick={onTokenClick}
                  activeStrong={highlightStrong}
                />
              ) : (
                <div
                  className="h-full rounded bg-[var(--color-paper-2)]/40"
                  aria-hidden
                />
              )}
            </div>
          </div>
          <StrongResizeHandle
            label="Resize KJV panel"
            onResize={resizeKjv}
          />
        </div>
      )}

      {popover && popoverStudy && (
        <WordStudyPopover
          rect={popover.rect}
          study={popoverStudy}
          onClose={() => setPopover(null)}
          onOpenDeepDive={openDeepDive}
          onNavigate={handleNavigate}
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
        "flex h-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-rule)] bg-white px-2 text-[var(--color-ink-2)] transition-colors",
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

// ─── Context-window input ─────────────────────────────────────────────────
// Lets the reader show N verses before & after the active verse in smaller
// type so the interlinear sits in its passage context. Renders as a tiny
// inline number input that steps 0..CONTEXT_MAX.

function ContextCountInput({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange(next: number): void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  // Keep the local draft string in sync when the committed value changes
  // from elsewhere (e.g. localStorage hydration, +/- buttons).
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    onChange(Number.isFinite(n) ? n : 0);
  };

  return (
    <span
      className="ml-1 inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]"
      title="Show this many verses before the active verse"
    >
      <span>−</span>
      <input
        type="number"
        min={0}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit((e.currentTarget as HTMLInputElement).value);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-label="Verses of context to show before the active verse"
        className="h-4 w-9 rounded border border-[var(--color-rule)] bg-white px-1 text-center font-mono text-[10px] tabular-nums text-[var(--color-ink)] focus:border-[var(--color-ink-2)]/60 focus:outline-none"
      />
      <span className="normal-case tracking-normal text-[10px] italic text-[var(--color-ink-2)]/70">
        before
      </span>
    </span>
  );
}

// ─── Smaller-font context verses ──────────────────────────────────────────
// Rendered above/below the active verse. Each line is clickable to make
// that verse the active one (which naturally triggers the interlinear and
// the study timer to move with the reader's attention).

function ContextVerses({
  verses,
  dir,
  onJump,
}: {
  verses: ParsedVerse[];
  dir: "ltr" | "rtl";
  onJump(verse: number): void;
}) {
  return (
    <ul
      dir={dir}
      className="my-1 flex flex-col gap-0.5 font-serif text-[13px] leading-snug text-[var(--color-ink-2)]"
    >
      {verses.map((v) => (
        <li key={v.verse}>
          <button
            type="button"
            onClick={() => onJump(v.verse)}
            className="w-full rounded px-1 text-left hover:bg-black/5 hover:text-[var(--color-ink)]"
            title={`Jump to verse ${v.verse}`}
          >
            <sup className="mr-1 font-mono text-[9px] tracking-wide text-[var(--color-ink-2)]/70">
              {v.verse}
            </sup>
            {v.plain}
          </button>
        </li>
      ))}
    </ul>
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
        // Match ContextVerses' size/leading so the active verse reads as part
        // of the same column; bolding (rather than a larger type size) is
        // what signals which verse is "current". The `px-1` matches the
        // inner padding on ContextVerses' buttons so verse numbers and
        // body text line up across the stacked verses.
        "font-serif text-[13px] font-bold leading-snug text-[var(--color-ink)] px-1",
        // Original-language scripts (Hebrew with pointing, polytonic Greek)
        // genuinely need more pixels to stay legible, so keep a modest bump
        // when the text IS the original.
        original && dir === "rtl" && "text-[16px] leading-normal",
        original && dir === "ltr" && "text-[15px]",
      )}
    >
      <sup className="mr-1 font-mono text-[9px] font-normal tracking-wide text-[var(--color-ink-2)]/80">
        {verse.verse}
      </sup>
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
  onTokenEnter(strong: string): void;
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
      {/* Verse-number badge — mirrors the <sup>N</sup> prefix shown on the
          leading context verses so the active verse is unambiguously labeled
          at the same anchor point. */}
      <span
        aria-hidden
        className="shrink-0 self-start pt-1 font-mono text-[11px] tracking-wide text-[var(--color-ink-2)]/80"
      >
        {verse.verse}
      </span>
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
              interactive ? () => onTokenEnter(tok.strong!) : undefined
            }
            onMouseLeave={interactive ? onTokenLeave : undefined}
            onFocus={interactive ? () => onTokenEnter(tok.strong!) : undefined}
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
  onClose,
  onOpenDeepDive,
  onNavigate,
}: {
  rect: DOMRect;
  study: WordStudy;
  onClose(): void;
  /** Opens the AI Assistant deep-dive drawer for this Strong's. */
  onOpenDeepDive(strong: string): void;
  onNavigate(target: BibleNavTarget): void;
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
        className="flex shrink-0 cursor-grab items-baseline gap-2 border-b border-[var(--color-rule)]/70 px-3 pb-1 pt-2 active:cursor-grabbing select-none"
        onPointerDown={onHeaderPointerDown}
        title="Drag to reposition"
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
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded px-1 text-[var(--color-ink-2)] hover:bg-black/5"
          aria-label="Close word study"
        >
          ×
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        style={{ maxHeight: maxBodyH }}
      >
        <StrongsOccurrencesSection
          strong={study.strong}
          onNavigate={onNavigate}
        />
        <div
          className="prose-bible text-[12px]"
          // The dictionary HTML is from a single, trusted upstream source
          // (bolls.life BDBT). It contains formatting tags only — no scripts —
          // and is sanitized of <S> footnotes by our server before display.
          dangerouslySetInnerHTML={{ __html: sanitizeDefHtml(study.detailHtml) }}
        />
        <PeriodUsageSection study={study} />
      </div>

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
    </div>
  );
}

// ─── Strong's concordance (KJV verse list) ────────────────────────────────

function StrongsOccurrencesSection({
  strong,
  onNavigate,
}: {
  strong: string;
  onNavigate(target: BibleNavTarget): void;
}) {
  const [listExpanded, setListExpanded] = useState(false);
  const [verseState, setVerseState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; count: number; verses: StrongsOccurrenceVerse[] }
    | { kind: "error"; message: string }
  >({ kind: "loading" });
  const [xrefState, setXrefState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; count: number; xrefs: StrongsXRefRow[] }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    setListExpanded(false);
    setVerseState({ kind: "loading" });
    setXrefState({ kind: "loading" });
    const ctl = new AbortController();
    const qs = new URLSearchParams({ strong });
    fetch(`/api/bible/strongs?${qs.toString()}`, { signal: ctl.signal })
      .then(async (r) => (await r.json()) as StrongsResponse)
      .then((data) => {
        if (data.error) {
          return setVerseState({ kind: "error", message: data.error });
        }
        setVerseState({
          kind: "ready",
          count: data.count,
          verses: data.verses ?? [],
        });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setVerseState({
          kind: "error",
          message: e instanceof Error ? e.message : "unknown error",
        });
      });
    fetch(`/api/bible/strongs/xrefs?${qs.toString()}`, { signal: ctl.signal })
      .then(async (r) => (await r.json()) as StrongsXRefsResponse)
      .then((data) => {
        if (data.error) {
          return setXrefState({ kind: "error", message: data.error });
        }
        setXrefState({
          kind: "ready",
          count: data.count,
          xrefs: data.xrefs ?? [],
        });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setXrefState({
          kind: "error",
          message: e instanceof Error ? e.message : "unknown error",
        });
      });
    return () => ctl.abort();
  }, [strong]);

  const loading =
    verseState.kind === "loading" || xrefState.kind === "loading";

  const verseCount =
    verseState.kind === "ready" ? verseState.count : 0;
  const xrefCount = xrefState.kind === "ready" ? xrefState.count : 0;
  const listCount = verseCount + xrefCount;

  const summaryParts: string[] = [];
  if (verseState.kind === "ready") {
    summaryParts.push(
      verseCount === 0
        ? "Not found in KJV interlinear"
        : verseCount === 1
          ? "1 verse"
          : `${verseCount.toLocaleString()} verses`,
    );
  }
  if (xrefState.kind === "ready") {
    summaryParts.push(
      xrefCount === 0
        ? "No xrefs"
        : xrefCount === 1
          ? "1 xref"
          : `${xrefCount.toLocaleString()} xrefs`,
    );
  }

  return (
    <div className="mb-2 border-b border-[var(--color-rule)]/70 pb-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        Cross-references
      </div>

      {loading && (
        <p className="mt-1 text-[11px] text-[var(--color-ink-2)]">
          Loading occurrences and xrefs…
        </p>
      )}

      {verseState.kind === "error" && (
        <p className="mt-1 text-[11px] text-rose-700">{verseState.message}</p>
      )}
      {xrefState.kind === "error" && (
        <p className="mt-1 text-[11px] text-rose-700">{xrefState.message}</p>
      )}

      {!loading && summaryParts.length > 0 && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[12px] text-[var(--color-ink)]">
            {summaryParts.join(" · ")}
          </span>
          {listCount > 0 && (
            <button
              type="button"
              onClick={() => setListExpanded((v) => !v)}
              className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink)] underline decoration-[var(--color-rule)] underline-offset-2 hover:decoration-[var(--color-ink-2)]"
              aria-expanded={listExpanded}
            >
              {listExpanded ? "Hide list" : "View all"}
            </button>
          )}
        </div>
      )}

      {listExpanded && listCount > 0 && (
        <ul
          className="mt-1.5 max-h-48 overflow-y-auto rounded border border-[var(--color-rule)]/60 bg-[var(--color-paper-2)]/40 py-1"
          role="list"
        >
          {verseState.kind === "ready" &&
            verseState.verses.map((v) => (
              <li key={`occ:${v.book}:${v.chapter}:${v.verse}`}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      bookId: v.book,
                      chapter: v.chapter,
                      verse: v.verse,
                    })
                  }
                  className="block w-full px-2 py-0.5 text-left hover:bg-black/5"
                >
                  <span className="font-serif text-[12px] text-[var(--color-ink)]">
                    {v.label}
                  </span>
                  <span className="ml-1.5 text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]">
                    Occurrence
                  </span>
                </button>
              </li>
            ))}
          {xrefState.kind === "ready" &&
            xrefState.xrefs.map((x) => (
              <li key={`xref:${x.fromVerseLabel}:${x.toLabel}:${x.category}`}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      bookId: x.to.book,
                      chapter: x.to.chapter,
                      verse: x.to.verseStart ?? 1,
                    })
                  }
                  title={`${XREF_CATEGORY_LABEL[x.category] ?? x.category} — ${x.note}`}
                  className="block w-full px-2 py-1 text-left hover:bg-black/5"
                >
                  <span className="font-serif text-[12px] text-[var(--color-ink)]">
                    {x.toLabel}
                  </span>
                  <span className="ml-1.5 text-[9px] uppercase tracking-widest text-[var(--color-ink-2)]">
                    {XREF_CATEGORY_LABEL[x.category] ?? x.category}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[var(--color-ink-2)]">
                    from {x.fromVerseLabel}
                  </span>
                </button>
              </li>
            ))}
        </ul>
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
