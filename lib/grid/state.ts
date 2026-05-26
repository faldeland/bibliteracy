"use client";

import { create } from "zustand";
import { DEFAULT_TRANSLATION_ID } from "@/lib/bible/translations";
import { addDays, today, ZOOM_PX_PER_DAY, type ZoomLevel } from "./time";
import type { BibleRef } from "./types";

/**
 * Shared view state for the endless paper grid. All lanes consume this so they
 * scroll and zoom in lockstep, while remaining independent React subtrees.
 */
export interface GridState {
  /** Width of one calendar day in CSS pixels. */
  pxPerDay: number;
  /** The calendar day rendered at the horizontal center of the viewport. */
  centerDate: Date;
  /** The book id selected in BooksLane (filters dot lanes), or null. */
  selectedBookId: string | null;
  /**
   * The verse currently focused in the BibleReader. Used by the new-dot
   * composer to pre-populate a reference tag so users can one-click tag
   * the dot with whatever passage they're reading.
   */
  currentBibleRef: BibleRef | null;
  /**
   * Strong's number selected or open in a word-study popover in BibleReader.
   * Drives the xref band (Strong's occurrence mode). Ephemeral — see `pinnedStrong`.
   */
  highlightStrong: string | null;
  /**
   * Strong's number locked while studying (survives verse navigation, e.g.
   * clicking occurrence dots in the xref band).
   */
  pinnedStrong: string | null;
  /** Translation selected in BibleReader (synced from localStorage). */
  bibleTranslationId: string;
  /**
   * Monotonic counter bumped by `navigateBible` so BibleReader can react to
   * navigation requests from sibling UI (e.g. xref band occurrence dots).
   */
  bibleNavigationSeq: number;
  /** Target for the latest `navigateBible` call. */
  bibleNavigationTarget: BibleRef | null;

  setPxPerDay(px: number): void;
  setCenterDate(d: Date): void;
  /** Pan by N pixels (positive scrolls into the future). */
  panByPx(px: number): void;
  /**
   * Zoom centered on a given pixel offset from the left edge of the viewport.
   * Keeps the day under the cursor stationary across the zoom.
   */
  zoomAt(opts: { newPxPerDay: number; cursorPx: number; viewportPx: number }): void;
  setZoom(level: ZoomLevel): void;
  recenterOnToday(): void;
  setSelectedBookId(id: string | null): void;
  setCurrentBibleRef(ref: BibleRef | null): void;
  setHighlightStrong(strong: string | null): void;
  setPinnedStrong(strong: string | null): void;
  setBibleTranslationId(id: string): void;
  /** Jump BibleReader to a passage (from grid chrome outside the reader). */
  navigateBible(ref: BibleRef): void;
}

export const MIN_PX_PER_DAY = 0.6;
export const MAX_PX_PER_DAY = 240;

export const useGridStore = create<GridState>((set, get) => ({
  pxPerDay: ZOOM_PX_PER_DAY.week,
  centerDate: today(),
  selectedBookId: null,
  currentBibleRef: null,
  highlightStrong: null,
  pinnedStrong: null,
  bibleTranslationId: DEFAULT_TRANSLATION_ID,
  bibleNavigationSeq: 0,
  bibleNavigationTarget: null,

  setPxPerDay(px) {
    set({ pxPerDay: clamp(px, MIN_PX_PER_DAY, MAX_PX_PER_DAY) });
  },

  setCenterDate(d) {
    set({ centerDate: d });
  },

  panByPx(px) {
    const { pxPerDay, centerDate } = get();
    const days = px / pxPerDay;
    // Snap to whole days to keep the day-grid crisp.
    const wholeDays = Math.round(days);
    if (wholeDays === 0) return;
    set({ centerDate: addDays(centerDate, wholeDays) });
  },

  zoomAt({ newPxPerDay, cursorPx, viewportPx }) {
    const { pxPerDay, centerDate } = get();
    const clamped = clamp(newPxPerDay, MIN_PX_PER_DAY, MAX_PX_PER_DAY);
    if (clamped === pxPerDay) return;

    // Day under the cursor in the OLD scale:
    const halfPx = viewportPx / 2;
    const daysFromCenter = (cursorPx - halfPx) / pxPerDay;
    const dayUnderCursor = addDays(centerDate, Math.round(daysFromCenter));

    // After zooming, recompute centerDate so dayUnderCursor stays put.
    const newDaysFromCenter = (cursorPx - halfPx) / clamped;
    const newCenter = addDays(dayUnderCursor, -Math.round(newDaysFromCenter));

    set({ pxPerDay: clamped, centerDate: newCenter });
  },

  setZoom(level) {
    set({ pxPerDay: ZOOM_PX_PER_DAY[level] });
  },

  recenterOnToday() {
    set({ centerDate: today() });
  },

  setSelectedBookId(id) {
    set({ selectedBookId: id });
  },

  setCurrentBibleRef(ref) {
    set({ currentBibleRef: ref });
  },

  setHighlightStrong(strong) {
    set({ highlightStrong: strong });
  },

  setPinnedStrong(strong) {
    set({ pinnedStrong: strong });
  },

  setBibleTranslationId(id) {
    set({ bibleTranslationId: id });
  },

  navigateBible(ref) {
    set((s) => ({
      bibleNavigationTarget: ref,
      bibleNavigationSeq: s.bibleNavigationSeq + 1,
    }));
  },
}));

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
