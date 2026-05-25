"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  Timeline,
  TimelineHeightPreset,
  TimelineUpdate,
} from "@/lib/grid/timelinesApi";
import { TIMELINE_HEIGHT_PX } from "@/lib/grid/timelinesApi";
import { toHexOrDefault } from "@/lib/grid/color";

interface TimelineSettingsSheetProps {
  /** The timeline being edited, or `null` when the sheet is closed. */
  timeline: Timeline | null;
  /**
   * Currently-rendered accent for this lane. Used as the starting color when
   * the timeline has `color === null` (i.e. is falling back to the client
   * default).
   */
  effectiveAccent: string;
  onClose(): void;
  onUpdate(id: string, patch: TimelineUpdate): void;
  onDelete?(timeline: Timeline): void;
}

const HEIGHT_PRESETS: Array<{ id: TimelineHeightPreset; label: string }> = [
  { id: "compact", label: "Compact" },
  { id: "normal", label: "Normal" },
  { id: "tall", label: "Tall" },
];

export function TimelineSettingsSheet({
  timeline,
  effectiveAccent,
  onClose,
  onUpdate,
  onDelete,
}: TimelineSettingsSheetProps) {
  const open = !!timeline;
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-[var(--color-paper)] transition-transform",
          open ? "translate-x-0 shadow-2xl" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {timeline && (
          <TimelineSettings
            // Remount when switching timelines so local draft state resets.
            key={timeline.id}
            timeline={timeline}
            effectiveAccent={effectiveAccent}
            onClose={onClose}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        )}
      </aside>
    </>
  );
}

function TimelineSettings({
  timeline,
  effectiveAccent,
  onClose,
  onUpdate,
  onDelete,
}: {
  timeline: Timeline;
  effectiveAccent: string;
  onClose(): void;
  onUpdate(id: string, patch: TimelineUpdate): void;
  onDelete?(timeline: Timeline): void;
}) {
  const [name, setName] = useState(timeline.name);
  const [color, setColor] = useState<string | null>(timeline.color);
  // Native <input type="color"> only accepts hex values, so we keep a
  // separate "display color" that's always a valid hex — if the current
  // accent came from a CSS variable we start from a neutral fallback.
  const [colorDraft, setColorDraft] = useState(() =>
    toHexOrDefault(timeline.color ?? effectiveAccent),
  );

  useEffect(() => setName(timeline.name), [timeline.name]);
  useEffect(() => {
    setColor(timeline.color);
    setColorDraft(toHexOrDefault(timeline.color ?? effectiveAccent));
  }, [timeline.color, effectiveAccent]);

  const commitName = () => {
    const next = name.trim();
    if (!next || next === timeline.name) {
      setName(timeline.name);
      return;
    }
    onUpdate(timeline.id, { name: next });
  };

  const commitColor = (value: string | null) => {
    setColor(value);
    onUpdate(timeline.id, { color: value });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between border-b border-[var(--color-rule)] px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
            Timeline settings
          </div>
          <h2 className="mt-1 flex items-center gap-2 font-serif text-xl text-[var(--color-ink)]">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: effectiveAccent }}
            />
            {timeline.name}
          </h2>
          {timeline.builtinKind && (
            <div className="mt-0.5 text-xs text-[var(--color-ink-2)]">
              Built-in lane · {timeline.builtinKind}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-sm text-[var(--color-ink-2)] hover:bg-black/5"
        >
          Close
        </button>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Field
          label="Name"
          hint="Shown in the lane header. 1–60 characters."
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setName(timeline.name);
                (e.target as HTMLInputElement).blur();
              }
            }}
            maxLength={60}
            className="w-full rounded-md border border-[var(--color-rule)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink-2)]"
          />
        </Field>

        <Field
          label="Dot color"
          hint={
            color === null
              ? "Using the default color for this lane."
              : "Custom color applied to this lane."
          }
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorDraft}
              onChange={(e) => {
                setColorDraft(e.target.value);
                commitColor(e.target.value);
              }}
              className="h-8 w-10 cursor-pointer rounded border border-[var(--color-rule)] bg-white p-0.5"
              aria-label="Pick a color"
            />
            <input
              type="text"
              value={color ?? ""}
              placeholder="auto"
              onChange={(e) => {
                const v = e.target.value.trim();
                setColor(v === "" ? null : v);
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                commitColor(v === "" ? null : v);
                if (v !== "") setColorDraft(toHexOrDefault(v));
              }}
              className="flex-1 rounded-md border border-[var(--color-rule)] bg-white px-3 py-1.5 font-mono text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink-2)]"
              aria-label="Color value"
            />
            <button
              type="button"
              onClick={() => commitColor(null)}
              disabled={color === null}
              className="rounded-md border border-[var(--color-rule)] px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)] hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
              title="Reset to the default color"
            >
              Reset
            </button>
          </div>
        </Field>

        <Field
          label="Row height"
          hint={`Currently ${TIMELINE_HEIGHT_PX[timeline.heightPreset]}px tall.`}
        >
          <div className="flex gap-1">
            {HEIGHT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onUpdate(timeline.id, { heightPreset: p.id })}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold uppercase tracking-widest",
                  timeline.heightPreset === p.id
                    ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                    : "border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-white",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Grid" hint="Configure the lane's background guides.">
          <div className="space-y-2">
            <Toggle
              label="Show day cells"
              checked={timeline.showDayCells}
              onChange={(v) =>
                onUpdate(timeline.id, { showDayCells: v })
              }
            />
            <Toggle
              label="Show today highlight"
              checked={timeline.showTodayHighlight}
              onChange={(v) =>
                onUpdate(timeline.id, { showTodayHighlight: v })
              }
            />
            <div>
              <div className="flex items-center justify-between text-xs text-[var(--color-ink-2)]">
                <span>Horizontal guides</span>
                <span className="font-mono">
                  {timeline.gridSubdivisions}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={timeline.gridSubdivisions}
                onChange={(e) =>
                  onUpdate(timeline.id, {
                    gridSubdivisions: Number(e.target.value),
                  })
                }
                className="w-full"
              />
              <div className="mt-0.5 text-[10px] text-[var(--color-ink-2)]/80">
                0 = none · 1 = midline · higher = finer subdivisions.
              </div>
            </div>
          </div>
        </Field>

        <Field
          label="Dot vertical anchor"
          hint="Where dots are anchored within the lane. 0 = top, 1 = bottom."
        >
          <div className="flex items-center justify-between text-xs text-[var(--color-ink-2)]">
            <span>Anchor</span>
            <span className="font-mono">
              {timeline.verticalAnchor.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={timeline.verticalAnchor}
            onChange={(e) =>
              onUpdate(timeline.id, {
                verticalAnchor: Number(e.target.value),
              })
            }
            className="w-full"
          />
          <div className="mt-0.5 text-[10px] text-[var(--color-ink-2)]/80">
            Time-of-day still offsets each dot around this anchor. 0.5
            matches the original spread-across-the-lane behavior.
          </div>
        </Field>

        {!timeline.builtinKind && onDelete && (
          <div className="border-t border-[var(--color-rule)] pt-5">
            <button
              type="button"
              onClick={() => onDelete(timeline)}
              className="w-full rounded-md border border-red-400/60 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50"
            >
              Delete timeline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ink-2)]">
        {label}
      </div>
      {children}
      {hint && (
        <div className="mt-1 text-[11px] text-[var(--color-ink-2)]/80">
          {hint}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--color-ink)]">
      <span>{label}</span>
      <span
        className={cn(
          "relative inline-block h-4 w-7 rounded-full transition-colors",
          checked ? "bg-[var(--color-ink)]" : "bg-[var(--color-rule)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}

