// Lightweight day-level date helpers. All dates are normalized to "calendar
// days" by zeroing the time portion in local time, so the grid lines up with
// the user's wall clock.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function today(): Date {
  return startOfDay(new Date());
}

export function addDays(d: Date, days: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY,
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return diffDays(a, b) === 0;
}

export function fromISO(iso: string): Date {
  return startOfDay(new Date(iso + "T00:00:00"));
}

export function toISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Datetime-local helpers ────────────────────────────────────────────────
// <input type="datetime-local"> speaks "YYYY-MM-DDTHH:mm" in the browser's
// local zone, with no offset suffix. The DB stores timestamptz (ISO UTC).
// These two functions are the only place we bridge the two representations.

/** Convert an ISO timestamp (UTC) to a value suitable for <input type="datetime-local">. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a <input type="datetime-local"> value (local wall time) back to ISO UTC. */
export function localInputToISO(local: string): string {
  // `new Date("YYYY-MM-DDTHH:mm")` interprets as local time; .toISOString() serializes as UTC.
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/** Human-friendly "3:07 PM" style time, in the viewer's local zone. */
export function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Fraction of the local day represented by `iso`'s time-of-day, in [0, 1).
 * Midnight = 0, noon = 0.5, 23:59:59 ≈ 0.9999. Falls back to 0.5 (noon) for
 * malformed input so dots with bad timestamps still land somewhere sane on the
 * chart instead of stacking at the day's edge.
 */
export function timeOfDayFraction(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0.5;
  const secs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return secs / 86400;
}

export type ZoomLevel = "day" | "week" | "month" | "quarter" | "year";

/** Recommended px-per-day at each zoom level. Tuned for a 1280px viewport. */
export const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  day: 96,
  week: 32,
  month: 12,
  quarter: 4,
  year: 1.4,
};

/** Map a px-per-day value to the nearest meaningful zoom level. */
export function zoomLevelFor(pxPerDay: number): ZoomLevel {
  if (pxPerDay >= 56) return "day";
  if (pxPerDay >= 20) return "week";
  if (pxPerDay >= 8) return "month";
  if (pxPerDay >= 2.4) return "quarter";
  return "year";
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatTickLabel(d: Date, zoom: ZoomLevel): string {
  const day = d.getDate();
  const mon = MONTHS_SHORT[d.getMonth()];
  const yr = d.getFullYear();
  switch (zoom) {
    case "day":
      return `${mon} ${day}`;
    case "week":
      return `${mon} ${day}`;
    case "month":
      return mon === "Jan" ? `${mon} ${yr}` : mon;
    case "quarter":
    case "year":
      return `${yr}`;
  }
}

/** Should this date render a major tick at the given zoom level? */
export function isMajorTick(d: Date, zoom: ZoomLevel): boolean {
  switch (zoom) {
    case "day":
      return true;
    case "week":
      return d.getDay() === 1; // Mondays
    case "month":
      return d.getDate() === 1;
    case "quarter":
      return d.getDate() === 1 && d.getMonth() % 3 === 0;
    case "year":
      return d.getDate() === 1 && d.getMonth() === 0;
  }
}
