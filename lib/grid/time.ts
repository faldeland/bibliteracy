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
