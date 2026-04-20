"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CrossRefArcs,
  type ArcHoverInfo,
  type XAxisMode,
} from "@/components/bible/CrossRefArcs";
import { BooksStrip } from "@/components/bible/BooksStrip";
import { bookById } from "@/lib/bible/books";
import { loadCrossReferences, type XRefMeta } from "@/lib/bible/xrefsClient";

const BOOKS_STRIP_HEIGHT = 26;
const LABELS_HEIGHT = 18;

function formatRef(ref: { book: string; chapter: number; verse: number }): string {
  const b = bookById(ref.book);
  return `${b?.abbr ?? ref.book} ${ref.chapter}:${ref.verse}`;
}

export default function AtlasPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hover, setHover] = useState<ArcHoverInfo | null>(null);
  const [hoverBook, setHoverBook] = useState<string | null>(null);
  const [meta, setMeta] = useState<XRefMeta | null>(null);
  const [xMode, setXMode] = useState<XAxisMode>("verse");

  useEffect(() => {
    loadCrossReferences().then((d) => setMeta(d.meta));
  }, []);

  // Track viewport size for the canvas. Re-runs on resize via ResizeObserver.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
      }
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const arcsHeight = Math.max(
    120,
    size.h - BOOKS_STRIP_HEIGHT - LABELS_HEIGHT - 8,
  );

  const tooltip = useMemo(() => {
    if (!hover) return null;
    const distance = Math.abs(hover.toIdx - hover.fromIdx);
    return {
      from: formatRef(hover.fromRef),
      to: formatRef(hover.toRef),
      distance,
      x: hover.x,
      y: hover.y,
    };
  }, [hover]);

  return (
    <main className="flex h-dvh w-dvw flex-col bg-[var(--color-paper)] text-[var(--color-ink)]">
      <header className="flex items-center justify-between border-b border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-2">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="font-serif text-lg font-semibold tracking-tight hover:underline"
          >
            Bibliteracy
          </Link>
          <span className="text-xs uppercase tracking-widest text-[var(--color-ink-2)]">
            Atlas · cross-references
          </span>
          {meta && (
            <span className="hidden text-xs text-[var(--color-ink-2)] sm:inline">
              {meta.count.toLocaleString()} arcs · votes {meta.votesMin}–
              {meta.votesMax}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ModeButton
            active={xMode === "verse"}
            onClick={() => setXMode("verse")}
            label="Verse-uniform"
            title="Every verse the same width — matches the original poster"
          />
          <ModeButton
            active={xMode === "word"}
            onClick={() => setXMode("word")}
            label="Word-proportional"
            title="Books sized by original-language word count, matching BooksLane"
          />
          <div className="mx-2 h-5 w-px bg-[var(--color-rule)]" />
          <Link
            href="/"
            className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-2)] hover:bg-black/5"
          >
            Back
          </Link>
        </div>
      </header>

      <div ref={hostRef} className="relative flex-1 overflow-hidden">
        {size.w > 0 && (
          <>
            <div className="absolute inset-x-0 top-0" style={{ height: arcsHeight }}>
              <CrossRefArcs
                width={size.w}
                height={arcsHeight}
                xMode={xMode}
                onHoverArc={setHover}
              />
            </div>
            <div
              className="absolute inset-x-0"
              style={{ top: arcsHeight + 4, height: BOOKS_STRIP_HEIGHT + LABELS_HEIGHT }}
            >
              <BooksStrip
                mode={xMode}
                height={BOOKS_STRIP_HEIGHT}
                highlightBookId={hover?.fromRef.book ?? hoverBook}
                onHoverBook={setHoverBook}
              />
            </div>
          </>
        )}

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-2 py-1.5 text-xs shadow-md"
            style={{
              left: Math.min(size.w - 220, Math.max(8, tooltip.x + 12)),
              top: Math.max(8, tooltip.y - 36),
              minWidth: 180,
            }}
          >
            <div className="font-semibold">
              {tooltip.from} <span className="text-[var(--color-ink-2)]">↔</span>{" "}
              {tooltip.to}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
              span: {tooltip.distance.toLocaleString()} verses
            </div>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 px-4 py-1.5 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">
        <span>
          Cross-reference data:{" "}
          <a
            href="https://www.openbible.info/labs/cross-references/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            OpenBible.info
          </a>{" "}
          (CC BY 4.0). Visualization inspired by Chris Harrison & Christoph
          Römhild, 2007.
        </span>
        <span>
          Color = canonical distance · Arc = source ↔ target verse
        </span>
      </footer>
    </main>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest " +
        (active
          ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
          : "text-[var(--color-ink-2)] hover:bg-black/5")
      }
    >
      {label}
    </button>
  );
}
