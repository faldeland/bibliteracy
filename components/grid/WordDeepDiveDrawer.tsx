"use client";

/**
 * AI Assistant deep-dive drawer.
 *
 * Opens from the right side of the viewport when the user clicks
 * "Deep study" in a pinned word-study popover. Fetches a rich,
 * multi-section scholarly study from `/api/bible/deep-dive` (which in
 * turn routes through the shared truth-rules LLM pipeline).
 *
 * Non-modal on purpose: the user can keep reading underneath, close with
 * Escape or the × button, and navigate to cognate / related Strong's
 * without losing their place in the passage.
 */

import { useEffect, useState } from "react";
import { matchTrustedWork } from "@/lib/llm/trustedSources";

// ─── Shapes (mirror the server contract in lib/bible/wordDeepDive.ts) ───────

interface Source {
  citation: string;
  type:
    | "lexicon"
    | "grammar"
    | "primary_text"
    | "database"
    | "monograph"
    | "other";
  locus?: string | null;
  url?: string | null;
}
interface Morphology {
  partOfSpeech: string;
  stem: string | null;
  root: string | null;
  notes: string | null;
}
interface SemanticSense {
  label: string;
  description: string;
  examples: Array<{ ref: string; gloss: string }>;
}
interface RelatedEntry {
  strong: string;
  lemma: string;
  relation: string;
}
interface WordDeepDive {
  strong: string;
  lemma: string;
  summary: string;
  morphology: Morphology;
  semanticRange: SemanticSense[];
  periodUsage: { period: string; description: string } | null;
  theologicalSignificance: string | null;
  translationNotes: string | null;
  relatedEntries: RelatedEntry[];
  sources: Source[];
  refusalReason: string | null;
  /** Optional scholarly uncertainty caveat (null when well-attested). */
  uncertainty?: string | null;
  model: string;
}
interface DeepDiveResponse {
  configured?: boolean;
  deepDive?: WordDeepDive | null;
  error?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WordDeepDiveDrawer({
  strong,
  onClose,
  onOpenRelated,
}: {
  /** Strong's number to study, or null when the drawer is closed. */
  strong: string | null;
  onClose(): void;
  /**
   * Fired when the user clicks a related entry. Parent decides whether
   * to replace the current drawer or ignore (e.g. if the related Strong's
   * isn't in the current chapter's word-study map).
   */
  onOpenRelated(strong: string): void;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "disabled" }
    | { kind: "empty"; reason?: string }
    | { kind: "error"; message: string }
    | { kind: "ready"; deepDive: WordDeepDive }
  >({ kind: "idle" });

  useEffect(() => {
    if (!strong) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    const ctl = new AbortController();
    const qs = new URLSearchParams({ strong });
    fetch(`/api/bible/deep-dive?${qs.toString()}`, { signal: ctl.signal })
      .then(async (r) => (await r.json()) as DeepDiveResponse)
      .then((data) => {
        if (data.configured === false) return setState({ kind: "disabled" });
        if (data.error) {
          return setState({ kind: "error", message: data.error });
        }
        if (!data.deepDive) return setState({ kind: "empty" });
        if (data.deepDive.refusalReason) {
          return setState({
            kind: "empty",
            reason: data.deepDive.refusalReason,
          });
        }
        setState({ kind: "ready", deepDive: data.deepDive });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "unknown error",
        });
      });
    return () => ctl.abort();
  }, [strong]);

  useEffect(() => {
    if (!strong) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [strong, onClose]);

  if (!strong) return null;

  return (
    <aside
      role="complementary"
      aria-label="Word study deep dive"
      className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-[32rem] flex-col border-l border-[var(--color-rule)] bg-white shadow-2xl"
    >
      <header className="flex items-start gap-3 border-b border-[var(--color-rule)]/70 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
              AI word study
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]/60">
              {strong}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-serif text-xl text-[var(--color-ink)]">
              {state.kind === "ready" ? state.deepDive.lemma : ""}
            </span>
            {state.kind === "ready" && (
              <span className="truncate text-[11px] italic text-[var(--color-ink-2)]">
                {state.deepDive.summary}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-0.5 text-[var(--color-ink-2)] hover:bg-black/5"
          aria-label="Close deep study"
          title="Close (Esc)"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 text-[12.5px] leading-relaxed text-[var(--color-ink)]">
        {state.kind === "loading" && (
          <LoadingSkeleton />
        )}
        {state.kind === "disabled" && (
          <EmptyNotice title="AI word study is not configured">
            Set <code className="rounded bg-black/5 px-1">PIPELLM_API_KEY</code>{" "}
            in <code className="rounded bg-black/5 px-1">.env.local</code> to
            enable deep dives.
          </EmptyNotice>
        )}
        {state.kind === "empty" && (
          <EmptyNotice title="No deep study available">
            {state.reason ??
              "The model didn't return a corroborated study for this word."}
          </EmptyNotice>
        )}
        {state.kind === "error" && (
          <EmptyNotice title="Couldn't load deep study" error>
            {state.message}
          </EmptyNotice>
        )}
        {state.kind === "ready" && (
          <DeepDiveBody
            deepDive={state.deepDive}
            onOpenRelated={onOpenRelated}
          />
        )}
      </div>

      {state.kind === "ready" && (
        <footer className="border-t border-[var(--color-rule)]/70 px-4 py-2 text-[10px] text-[var(--color-ink-2)]/80">
          Generated by {state.deepDive.model}. All claims sourced per the
          truthfulness &amp; citation protocol.
        </footer>
      )}
    </aside>
  );
}

// ─── Body ───────────────────────────────────────────────────────────────────

function DeepDiveBody({
  deepDive,
  onOpenRelated,
}: {
  deepDive: WordDeepDive;
  onOpenRelated(strong: string): void;
}) {
  const m = deepDive.morphology;
  const hasMorph =
    m.partOfSpeech.length > 0 || m.stem || m.root || m.notes;

  return (
    <div className="space-y-5">
      {deepDive.uncertainty ? (
        <div
          className="rounded-sm border border-amber-600/40 bg-amber-50/60 px-2 py-1.5 text-[11.5px] italic leading-snug text-amber-900"
          title="Scholarly uncertainty disclosed by the model per §7 of the truth rules."
        >
          <span className="mr-1 text-[9.5px] font-semibold not-italic uppercase tracking-wider">
            Caveat
          </span>
          {deepDive.uncertainty}
        </div>
      ) : null}
      {hasMorph && (
        <Section title="Morphology">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-[12px]">
            {m.partOfSpeech && (
              <>
                <dt className="text-[var(--color-ink-2)]">Part of speech</dt>
                <dd>{m.partOfSpeech}</dd>
              </>
            )}
            {m.stem && (
              <>
                <dt className="text-[var(--color-ink-2)]">Stem</dt>
                <dd>{m.stem}</dd>
              </>
            )}
            {m.root && (
              <>
                <dt className="text-[var(--color-ink-2)]">Root</dt>
                <dd>{m.root}</dd>
              </>
            )}
            {m.notes && (
              <>
                <dt className="text-[var(--color-ink-2)]">Notes</dt>
                <dd>{m.notes}</dd>
              </>
            )}
          </dl>
        </Section>
      )}

      {deepDive.semanticRange.length > 0 && (
        <Section title="Semantic range">
          <ol className="space-y-3">
            {deepDive.semanticRange.map((s, i) => (
              <li key={i}>
                <div className="font-semibold text-[var(--color-ink)]">
                  {i + 1}. {s.label}
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--color-ink)]">
                  {s.description}
                </p>
                {s.examples.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-3 text-[11.5px] text-[var(--color-ink-2)]">
                    {s.examples.map((e, j) => (
                      <li key={j}>
                        <span className="font-medium text-[var(--color-ink)]">
                          {e.ref}
                        </span>
                        {e.gloss && (
                          <span className="italic"> — {e.gloss}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {deepDive.periodUsage && (
        <Section title={`In its time — ${deepDive.periodUsage.period}`}>
          <p>{deepDive.periodUsage.description}</p>
        </Section>
      )}

      {deepDive.theologicalSignificance && (
        <Section title="Theological significance">
          <p>{deepDive.theologicalSignificance}</p>
        </Section>
      )}

      {deepDive.translationNotes && (
        <Section title="Translation notes">
          <p>{deepDive.translationNotes}</p>
        </Section>
      )}

      {deepDive.relatedEntries.length > 0 && (
        <Section title="Related entries">
          <ul className="space-y-1 text-[12px]">
            {deepDive.relatedEntries.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <button
                  type="button"
                  onClick={() => onOpenRelated(r.strong)}
                  className="rounded border border-[var(--color-rule)] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-widest text-[var(--color-ink)] hover:border-[var(--color-ink-2)]/50 hover:bg-black/5"
                  title={`Open deep study for ${r.strong}`}
                >
                  {r.strong}
                </button>
                {r.lemma && (
                  <span className="font-serif text-[13px]">{r.lemma}</span>
                )}
                <span className="text-[11px] italic text-[var(--color-ink-2)]">
                  {r.relation}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {deepDive.sources.length > 0 && (
        <Section
          title="Cross-references"
          badge={
            <span
              className="rounded-sm border border-emerald-600/50 bg-emerald-50/60 px-1 py-[1px] text-[8.5px] tracking-wider text-emerald-900"
              title="Every citation matches a work on the trusted scholarly allowlist (lib/llm/trustedSources.ts) and the draft was audited against the retrieved BDB/Thayer entry."
            >
              Audited
            </span>
          }
        >
          <ul className="space-y-0.5 text-[11px] text-[var(--color-ink-2)]">
            {deepDive.sources.map((s, i) => {
              const work = matchTrustedWork(s.citation);
              const title = work
                ? `${work.title} — ${work.editors}${work.year ? `, ${work.year}` : ""}`
                : s.type;
              const body = (
                <>
                  {work ? (
                    <span className="mr-1 rounded-sm border border-[var(--color-rule)]/60 bg-[var(--color-surface)]/60 px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-[var(--color-ink-2)]">
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
                <li key={i} className="flex items-baseline gap-0">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-baseline underline decoration-dotted underline-offset-2 hover:text-[var(--color-ink)]"
                      title={title}
                    >
                      {body}
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-baseline"
                      title={title}
                    >
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        <span>{title}</span>
        {badge}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-3 w-1/2 rounded bg-black/10" />
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-black/10" />
        <div className="h-2 w-11/12 rounded bg-black/10" />
        <div className="h-2 w-3/4 rounded bg-black/10" />
      </div>
      <div className="h-3 w-1/3 rounded bg-black/10" />
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-black/10" />
        <div className="h-2 w-10/12 rounded bg-black/10" />
      </div>
      <div className="mt-4 text-[11px] text-[var(--color-ink-2)]">
        Consulting lexica and period sources…
      </div>
    </div>
  );
}

function EmptyNotice({
  title,
  error,
  children,
}: {
  title: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded border border-[var(--color-rule)] p-3 text-[12px] ${
        error ? "text-rose-700" : "text-[var(--color-ink-2)]"
      }`}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
