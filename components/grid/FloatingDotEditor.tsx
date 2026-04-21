"use client";

import { useEffect, useRef, useState } from "react";
import type { Dot } from "@/lib/grid/types";
import type { DotUpdate } from "@/lib/grid/dotsApi";
import { DotEditor } from "./DotEditor";

const LAYOUT_STORAGE_KEY = "bibliteracy:dot-editor-popup:layout:v1";
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 580;
const MIN_WIDTH = 340;
const MIN_HEIGHT = 320;
const PAD = 8;

interface Layout {
  left: number;
  top: number;
  width: number;
  height: number;
}

function readStoredLayout(): Partial<Layout> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Layout>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.left !== "number" ||
      typeof parsed.top !== "number" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredLayout(layout: Layout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be disabled (private mode, quota). Non-fatal.
  }
}

function clampLayout(next: Layout): Layout {
  if (typeof window === "undefined") return next;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(next.width, MIN_WIDTH), vw - PAD * 2);
  const height = Math.min(Math.max(next.height, MIN_HEIGHT), vh - PAD * 2);
  const left = Math.max(PAD, Math.min(next.left, vw - width - PAD));
  const top = Math.max(PAD, Math.min(next.top, vh - height - PAD));
  return { left, top, width, height };
}

function initialLayout(): Layout {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const stored = readStoredLayout();
  const width = stored?.width ?? DEFAULT_WIDTH;
  const height = stored?.height ?? DEFAULT_HEIGHT;
  const left = stored?.left ?? Math.max(PAD, vw - width - 32);
  const top = stored?.top ?? Math.max(PAD, Math.round((vh - height) / 2));
  return clampLayout({ left, top, width, height });
}

interface FloatingDotEditorProps {
  dot: Dot;
  /** Close the popup without saving. */
  onClose(): void;
  onSave(patch: DotUpdate): void;
  onDelete?(): void;
  /** Bring the editor back to the side panel (optional). */
  onReattach?(): void;
}

export function FloatingDotEditor({
  dot,
  onClose,
  onSave,
  onDelete,
  onReattach,
}: FloatingDotEditorProps) {
  const [layout, setLayout] = useState<Layout>(() => initialLayout());
  const layoutRef = useRef<Layout>(layout);
  layoutRef.current = layout;
  const ref = useRef<HTMLDivElement | null>(null);

  // Persist layout whenever it changes. Writes are tiny and infrequent.
  useEffect(() => {
    writeStoredLayout(layout);
  }, [layout]);

  // Keep the popup within the viewport when the window is resized.
  useEffect(() => {
    const onResize = () => {
      setLayout((prev) => clampLayout(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Escape closes the popup (except when typing into a form control, where
  // Escape has local UA meaning like clearing search inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Drag from the header — pointer capture so the drag survives leaving the
  // popup bounds. Clicks on buttons in the header don't start a drag.
  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = layoutRef.current;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      setLayout(() =>
        clampLayout({
          left: start.left + (ev.clientX - startX),
          top: start.top + (ev.clientY - startY),
          width: start.width,
          height: start.height,
        }),
      );
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

  // Bottom-right resize handle. Grows width/height from the anchored
  // top-left corner, clamped to viewport and minimum size.
  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = layoutRef.current;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      setLayout(() =>
        clampLayout({
          left: start.left,
          top: start.top,
          width: start.width + (ev.clientX - startX),
          height: start.height + (ev.clientY - startY),
        }),
      );
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
      role="dialog"
      aria-label={`Edit dot: ${dot.title || "Untitled"}`}
      data-dot-editor-popup
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-[var(--color-rule)] bg-[var(--color-paper)] text-sm text-[var(--color-ink)] shadow-2xl"
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex shrink-0 cursor-grab select-none items-start justify-between gap-2 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/70 px-3 py-2 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        title="Drag to reposition"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Edit dot · {dot.kind}
            {dot.logosTag ? ` · ${dot.logosTag}` : ""}
          </div>
          <div className="truncate font-serif text-[15px] leading-tight text-[var(--color-ink)]">
            {dot.title || "Untitled"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onReattach && (
            <button
              type="button"
              onClick={onReattach}
              className="rounded-full px-2 py-1 text-xs text-[var(--color-ink-2)] hover:bg-black/5"
              title="Return to side panel"
            >
              Reattach
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-base leading-none text-[var(--color-ink-2)] hover:bg-black/5"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DotEditor
          // Re-mount the form when the active dot changes so unsaved draft
          // state from one dot doesn't leak into the next.
          key={dot.id}
          dot={dot}
          onCancel={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>

      <div
        onPointerDown={onResizePointerDown}
        role="presentation"
        aria-hidden
        title="Drag to resize"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        style={{
          background:
            "linear-gradient(135deg, transparent 0 45%, var(--color-rule) 45% 55%, transparent 55% 70%, var(--color-rule) 70% 80%, transparent 80% 100%)",
        }}
      />
    </div>
  );
}
