"use client";

import { createPortal } from "react-dom";
import { VersePreview, type VerseRef } from "./VersePreview";

const CARD_WIDTH = 320;
const VIEWPORT_PAD = 8;
const GAP_PX = 8;

interface VerseHoverCardProps {
  ref_: VerseRef;
  translationId: string;
  /** Viewport coordinates — card is placed above this point when possible. */
  viewportAnchor: { x: number; y: number };
}

/**
 * Portaled hover card for a single verse. Clamps horizontally and prefers
 * opening upward so it is not clipped by compact bible-strip bands.
 */
export function VerseHoverCard({
  ref_,
  translationId,
  viewportAnchor,
}: VerseHoverCardProps) {
  if (typeof document === "undefined") return null;

  const vw =
    typeof window !== "undefined" ? window.innerWidth : CARD_WIDTH + VIEWPORT_PAD * 2;
  const left = Math.max(
    VIEWPORT_PAD,
    Math.min(vw - CARD_WIDTH - VIEWPORT_PAD, viewportAnchor.x - CARD_WIDTH / 2),
  );
  const top = viewportAnchor.y;

  return createPortal(
    <div
      className="pointer-events-none fixed z-50 w-[320px] max-w-[calc(100vw-16px)] -translate-y-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 shadow-xl"
      style={{
        left,
        top: top - GAP_PX,
      }}
      role="tooltip"
    >
      <VersePreview ref_={ref_} translationId={translationId} />
    </div>,
    document.body,
  );
}
