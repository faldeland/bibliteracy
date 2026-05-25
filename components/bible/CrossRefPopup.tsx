"use client";



import { useEffect, useRef } from "react";

import { createPortal } from "react-dom";

import { VersePreview, type VerseRef } from "./VersePreview";

import { cn } from "@/lib/utils";



export type { VerseRef };



interface CrossRefPopupProps {

  from: VerseRef;

  to: VerseRef;

  /** Click position relative to the arcs host. */

  anchor: { x: number; y: number };

  /** Pixel bounds available for placement (usually the arcs container size). */

  bounds: { width: number; height: number };

  /**

   * When set, the popup is portaled to `document.body` and anchored in

   * viewport coordinates — used by the compact CrossRefBand above BooksLane.

   */

  viewportAnchor?: { x: number; y: number };

  translationId: string;

  onClose(): void;

  onOpenDetail(): void;

}



/**

 * Small floating card anchored near the click point. Shows both sides of the

 * cross-reference with inline verse text, plus a "View detail →" button that

 * escalates to the full slide-out sheet.

 *

 * The popup does its own light-weight viewport clamping; it deliberately

 * does NOT portal out to `document.body` because the atlas page is a

 * dedicated full-viewport canvas — z-index inside the host is enough.

 */

export function CrossRefPopup({

  from,

  to,

  anchor,

  bounds,

  viewportAnchor,

  translationId,

  onClose,

  onOpenDetail,

}: CrossRefPopupProps) {

  const ref = useRef<HTMLDivElement | null>(null);



  // Dismiss on outside click and on Escape.

  useEffect(() => {

    const onDown = (e: MouseEvent) => {

      if (!ref.current) return;

      if (ref.current.contains(e.target as Node)) return;

      onClose();

    };

    const onKey = (e: KeyboardEvent) => {

      if (e.key === "Escape") onClose();

    };

    // mousedown (not click) so the same click that lands on another arc

    // closes this popup before opening the next one.

    window.addEventListener("mousedown", onDown);

    window.addEventListener("keydown", onKey);

    return () => {

      window.removeEventListener("mousedown", onDown);

      window.removeEventListener("keydown", onKey);

    };

  }, [onClose]);



  const cardW = 340;

  const cardH = 220;

  const pad = 8;

  const placementAnchor = viewportAnchor ?? anchor;

  const placementBounds = viewportAnchor

    ? {

        width: typeof window !== "undefined" ? window.innerWidth : bounds.width,

        height: typeof window !== "undefined" ? window.innerHeight : bounds.height,

      }

  : bounds;

  const left = Math.max(

    pad,

    Math.min(placementBounds.width - cardW - pad, placementAnchor.x - cardW / 2),

  );

  const top =

    placementAnchor.y - cardH - 16 >= pad

      ? placementAnchor.y - cardH - 16

      : Math.min(

          placementBounds.height - cardH - pad,

          placementAnchor.y + 16,

        );



  const card = (

    <div

      ref={ref}

      className={cn(

        "z-50 w-[340px] rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] shadow-xl",

        viewportAnchor ? "fixed" : "absolute z-20",

      )}

      style={{ left, top }}

      role="dialog"

      aria-label="Cross-reference"

    >

      <div className="flex items-center justify-between border-b border-[var(--color-rule)] px-3 py-2">

        <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">

          Cross-reference

        </div>

        <button

          type="button"

          onClick={onClose}

          aria-label="Close"

          className="rounded-full px-2 text-sm text-[var(--color-ink-2)] hover:bg-black/5"

        >

          ×

        </button>

      </div>



      <div className="max-h-[260px] overflow-y-auto px-3 py-2">

        <VersePreview ref_={from} translationId={translationId} />

        <div className="my-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-ink-2)]">

          <span className="h-px flex-1 bg-[var(--color-rule)]" />

          <span>↔</span>

          <span className="h-px flex-1 bg-[var(--color-rule)]" />

        </div>

        <VersePreview ref_={to} translationId={translationId} />

      </div>



      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-rule)] px-3 py-2">

        <button

          type="button"

          onClick={onOpenDetail}

          className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--color-paper)] hover:opacity-90"

        >

          View detail →

        </button>

      </div>

    </div>

  );



  if (viewportAnchor && typeof document !== "undefined") {

    return createPortal(card, document.body);

  }

  return card;

}


