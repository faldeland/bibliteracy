"use client";



import {

  useCallback,

  useEffect,

  useRef,

  useState,

  type FormEvent,

} from "react";

import type { WordStudy } from "@/lib/bible/bollsApi";

import { classifyStrongsSearchQuery } from "@/lib/bible/parseStrongs";

import { loadStrongsOccurrences } from "@/lib/bible/strongsClient";

import { getTranslation } from "@/lib/bible/translations";

import { useGridStore } from "@/lib/grid/state";

import { cn } from "@/lib/utils";

import { StrongsOccurrenceRow } from "./StrongsOccurrenceRow";



interface StrongsOccurrenceVerse {

  book: string;

  chapter: number;

  verse: number;

  label: string;

}



interface StrongsOccurrencesResponse {

  strong?: string;

  count?: number;

  verses?: StrongsOccurrenceVerse[];

  error?: string;

}



interface WordsResponse {

  words: Record<string, WordStudy>;

  error?: string;

}



interface StrongsWordMatch {

  strong: string;

  lexeme: string;

  transliteration: string;

  shortGloss: string;

}



interface StrongsWordSearchResponse {

  query?: string;

  matches?: StrongsWordMatch[];

  error?: string;

}



type LoadState =

  | { kind: "idle" }

  | { kind: "loading"; label: string }

  | {

      kind: "word-matches";

      word: string;

      matches: StrongsWordMatch[];

    }

  | {

      kind: "ready";

      strong: string;

      count: number;

      verses: StrongsOccurrenceVerse[];

      study: WordStudy | null;

    }

  | { kind: "error"; message: string };



/** Strong's concordance search and verse list for the grid bottom pane. */

export function StrongsPanel() {
  const highlightStrong = useGridStore((s) => s.highlightStrong);

  const pinnedStrong = useGridStore((s) => s.pinnedStrong);

  const setPinnedStrong = useGridStore((s) => s.setPinnedStrong);

  const navigateBible = useGridStore((s) => s.navigateBible);

  const translationId = useGridStore((s) => s.bibleTranslationId);

  const translationLabel = getTranslation(translationId).label;



  const [query, setQuery] = useState("");

  const [state, setState] = useState<LoadState>({ kind: "idle" });

  const loadedStrongRef = useRef<string | null>(null);



  const loadStrong = useCallback(

    async (strong: string, opts?: { force?: boolean; pin?: boolean }) => {

      if (!opts?.force && loadedStrongRef.current === strong) return;



      loadedStrongRef.current = strong;

      setQuery(strong);

      if (opts?.pin ?? true) setPinnedStrong(strong);

      setState({ kind: "loading", label: strong });



      try {

        const [occRes, wordsRes] = await Promise.all([

          fetch(`/api/bible/strongs?${new URLSearchParams({ strong })}`),

          fetch(`/api/bible/words?${new URLSearchParams({ strongs: strong })}`),

        ]);



        const occ = (await occRes.json()) as StrongsOccurrencesResponse;

        const words = (await wordsRes.json()) as WordsResponse;



        if (!occRes.ok || occ.error) {

          throw new Error(occ.error ?? `HTTP ${occRes.status}`);

        }

        if (words.error) {

          throw new Error(words.error);

        }



        const verses = occ.verses ?? [];

        void loadStrongsOccurrences(strong).catch(() => {

          // Band dots are best-effort; panel still shows the verse list.

        });



        setState({

          kind: "ready",

          strong,

          count: occ.count ?? verses.length,

          verses,

          study: words.words[strong] ?? null,

        });

      } catch (e) {

        loadedStrongRef.current = null;

        setState({

          kind: "error",

          message:

            e instanceof Error ? e.message : "Could not load occurrences.",

        });

      }

    },

    [setPinnedStrong],

  );



  const searchWord = useCallback(async (word: string) => {

    loadedStrongRef.current = null;

    setPinnedStrong(null);

    setState({ kind: "loading", label: word });



    try {

      const res = await fetch(

        `/api/bible/strongs/words?${new URLSearchParams({ q: word })}`,

      );

      const data = (await res.json()) as StrongsWordSearchResponse;

      if (!res.ok || data.error) {

        throw new Error(data.error ?? `HTTP ${res.status}`);

      }



      const matches = data.matches ?? [];

      if (matches.length === 0) {

        setState({

          kind: "error",

          message: `No Strong's entries found for “${word}”.`,

        });

        return;

      }



      setState({ kind: "word-matches", word, matches });

    } catch (e) {

      setState({

        kind: "error",

        message:

          e instanceof Error ? e.message : "Could not search dictionary.",

      });

    }

  }, [setPinnedStrong]);



  const runSearch = useCallback(

    async (raw: string, opts?: { force?: boolean }) => {

      const classified = classifyStrongsSearchQuery(raw);

      if (!classified) {

        loadedStrongRef.current = null;

        setState({

          kind: "error",

          message:

            "Enter a Strong's number (G2316, H7225) or an English word (God, love).",

        });

        return;

      }



      if (classified.kind === "strong") {

        await loadStrong(classified.strong, { ...opts, pin: true });

        return;

      }



      setQuery(classified.word);

      await searchWord(classified.word);

    },

    [loadStrong, searchWord],

  );



  useEffect(() => {
    const activeStrong = highlightStrong ?? pinnedStrong;
    if (!activeStrong) return;

    setQuery(activeStrong);
    void loadStrong(activeStrong, { pin: false });
  }, [highlightStrong, pinnedStrong, loadStrong]);



  const onSubmit = (e: FormEvent) => {

    e.preventDefault();

    void runSearch(query, { force: true });

  };



  const activeStrong =

    state.kind === "ready"

      ? state.strong

      : pinnedStrong;



  return (

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      <div className="shrink-0 border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2">

        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">

          Strong&apos;s concordance

        </div>

        <p className="mt-0.5 text-[11px] text-[var(--color-ink-2)]">

          Search by Strong&apos;s number or English word — KJV interlinear

          occurrences.

        </p>

        <form onSubmit={onSubmit} className="mt-2 flex gap-2">

          <input

            type="search"

            value={query}

            onChange={(e) => setQuery(e.target.value)}

            placeholder="G2316, H7225, or God"

            spellCheck={false}

            className="min-w-0 flex-1 rounded-md border border-[var(--color-rule)] bg-white px-2 py-1.5 font-mono text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-2)]/70 focus:border-[var(--color-ink-2)]/60 focus:outline-none"

            aria-label="Strong's number or word"

          />

          <button

            type="submit"

            className="shrink-0 rounded-md border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-paper)] hover:opacity-90"

          >

            Search

          </button>

        </form>

      </div>



      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">

        {state.kind === "idle" && !pinnedStrong && (

          <p className="text-sm text-[var(--color-ink-2)]">

            Search by Strong&apos;s number or English word, or click a word in

            the reader to study it here.

          </p>

        )}



        {state.kind === "loading" && (

          <p className="text-sm text-[var(--color-ink-2)]">

            Loading {state.label}…

          </p>

        )}



        {state.kind === "error" && (

          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">

            {state.message}

          </p>

        )}



        {state.kind === "word-matches" && (

          <>

            <p className="mb-2 text-[11px] text-[var(--color-ink-2)]">

              {state.matches.length === 1

                ? "1 Strong's match"

                : `${state.matches.length} Strong's matches`}{" "}

              for “{state.word}” — choose one for the concordance.

            </p>

            <ul className="divide-y divide-[var(--color-rule)]/60 rounded border border-[var(--color-rule)]/60">

              {state.matches.map((m) => (

                <li key={m.strong}>

                  <button

                    type="button"

                    onClick={() => void loadStrong(m.strong, { force: true })}

                    className={cn(

                      "block w-full px-3 py-2 text-left",

                      "hover:bg-black/[0.04]",

                    )}

                  >

                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">

                      <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--color-ink)]">

                        {m.strong}

                      </span>

                      <span className="font-serif text-[13px] text-[var(--color-ink)]">

                        {m.lexeme || m.transliteration || "—"}

                      </span>

                      {m.transliteration && m.lexeme ? (

                        <span className="text-[12px] italic text-[var(--color-ink-2)]">

                          {m.transliteration}

                        </span>

                      ) : null}

                    </div>

                    {m.shortGloss ? (

                      <p className="mt-0.5 text-[12px] text-[var(--color-ink-2)]">

                        {m.shortGloss}

                      </p>

                    ) : null}

                  </button>

                </li>

              ))}

            </ul>

          </>

        )}



        {state.kind === "ready" && (

          <>

            {state.study ? (

              <header className="mb-3 border-b border-[var(--color-rule)]/60 pb-3">

                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">

                  <span className="font-serif text-lg text-[var(--color-ink)]">

                    {state.study.lexeme}

                  </span>

                  <span className="text-[12px] italic text-[var(--color-ink-2)]">

                    {state.study.transliteration}

                  </span>

                  <span className="ml-auto font-mono text-[11px] uppercase tracking-widest text-[var(--color-ink-2)]">

                    {state.strong}

                  </span>

                </div>

                <p className="mt-1 text-[12px] text-[var(--color-ink)]">

                  {state.study.shortGloss}

                </p>

              </header>

            ) : (

              <header className="mb-3">

                <span className="font-mono text-[12px] uppercase tracking-widest text-[var(--color-ink)]">

                  {state.strong}

                </span>

              </header>

            )}



            <p className="mb-2 text-[11px] text-[var(--color-ink-2)]">

              {state.count === 0

                ? "Not found in KJV interlinear."

                : state.count === 1

                  ? "1 verse"

                  : `${state.count.toLocaleString()} verses`}

              {state.count > 0 ? (
                <>
                  {" "}
                  · text in {translationLabel}
                </>
              ) : null}

            </p>



            {state.verses.length > 0 ? (

              <ul className="divide-y divide-[var(--color-rule)]/60 rounded border border-[var(--color-rule)]/60">

                {state.verses.map((v) => (
                  <StrongsOccurrenceRow
                    key={`${v.book}:${v.chapter}:${v.verse}`}
                    ref_={{
                      book: v.book,
                      chapter: v.chapter,
                      verse: v.verse,
                    }}
                    translationId={translationId}
                    fallbackLabel={v.label}
                    onClick={() => {
                      if (activeStrong) setPinnedStrong(activeStrong);
                      navigateBible({
                        book: v.book,
                        chapter: v.chapter,
                        verseStart: v.verse,
                      });
                    }}
                  />
                ))}

              </ul>

            ) : null}

          </>

        )}

      </div>

    </div>

  );

}

