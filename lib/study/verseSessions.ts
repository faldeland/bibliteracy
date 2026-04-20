/**
 * Verse-session time tracker.
 *
 * Every time the reader lands on a verse, we open a "session" scoped to
 * `book:chapter:verse`. The session accumulates *active* milliseconds —
 * not wall-clock ms — so a chapter left open while the user walked away
 * for lunch doesn't get credited as study time.
 *
 * "Active" is defined as:
 *   • the tab is visible (`document.visibilityState === 'visible'`), and
 *   • there was a user activity event (mousemove, click, keydown,
 *     scroll, touchstart) within the last IDLE_THRESHOLD_MS.
 *
 * The tracker:
 *   • exposes `startSession(verseKey)` + `endSession()` for the reader
 *     to call on verse change / unmount;
 *   • ticks a 1 Hz heartbeat that adds 1 000 ms to the live session's
 *     `activeMs` iff the active condition holds at the tick;
 *   • persists a rollup map `{ [verseKey]: VerseStats }` plus an
 *     append-only session log to localStorage, both under the
 *     namespace `STORAGE_KEY`;
 *   • notifies subscribers on every mutation so the UI can re-render
 *     the live timer + the per-verse totals dropdown.
 *
 * The module is SSR-safe: every `window` / `document` access is guarded
 * and `ensureRuntime` is idempotent. Consumers should only import it
 * from client components.
 */

// ─── Public types ──────────────────────────────────────────────────────────

/** Canonical, translation-agnostic verse key: e.g. "Jhn:3:16". */
export type VerseKey = string;

export interface VerseMeta {
  /** Canonical book id (e.g. "Jhn"). */
  bookId: string;
  chapter: number;
  verse: number;
}

export interface VerseStats extends VerseMeta {
  /** Total active milliseconds across all sessions on this verse. */
  totalMs: number;
  /** Number of distinct sessions recorded on this verse. */
  sessionCount: number;
  /** Epoch ms of the most recent session on this verse. */
  lastVisitedAt: number;
}

export interface CurrentSession extends VerseMeta {
  verseKey: VerseKey;
  /** Epoch ms when this session started. */
  startedAt: number;
  /** Active ms accumulated so far in *this* session. */
  activeMs: number;
}

export interface SessionLogEntry extends VerseMeta {
  verseKey: VerseKey;
  /** Epoch ms when the session started. */
  startedAt: number;
  /** Epoch ms when the session ended (navigated away / unload). */
  endedAt: number;
  /** Active ms accumulated across this session. */
  activeMs: number;
}

export interface TrackerSnapshot {
  /** Live session, if any. Updates every tick. */
  current: CurrentSession | null;
  /** Rollup totals keyed by `VerseKey`. */
  totals: Record<VerseKey, VerseStats>;
}

// ─── Configuration ─────────────────────────────────────────────────────────

/** Milliseconds of inactivity after which a tick no longer counts. */
const IDLE_THRESHOLD_MS = 30_000;
/** Heartbeat interval; lower = finer resolution, higher = cheaper. */
const TICK_MS = 1_000;
/** Append-only session log cap. Oldest entries get evicted past this. */
const LOG_CAP = 500;
/** localStorage namespace. Bump the suffix if the schema changes. */
const STORAGE_KEY = "bibliteracy.verseSessions.v1";

// ─── Key helpers ───────────────────────────────────────────────────────────

export function verseKey(meta: VerseMeta): VerseKey {
  return `${meta.bookId}:${meta.chapter}:${meta.verse}`;
}

// ─── Internal state ────────────────────────────────────────────────────────

interface PersistedShape {
  totals: Record<VerseKey, VerseStats>;
  log: SessionLogEntry[];
}

interface RuntimeState {
  current: CurrentSession | null;
  totals: Record<VerseKey, VerseStats>;
  log: SessionLogEntry[];
  /** Epoch ms of the last user-activity event. */
  lastActivityAt: number;
  listeners: Set<(s: TrackerSnapshot) => void>;
  /** `setInterval` handle for the 1 Hz tick. */
  tickHandle: number | null;
  /** True once global listeners have been installed. */
  initialized: boolean;
}

const state: RuntimeState = {
  current: null,
  totals: {},
  log: [],
  lastActivityAt: 0,
  listeners: new Set(),
  tickHandle: null,
  initialized: false,
};

// ─── Persistence ───────────────────────────────────────────────────────────

function loadPersisted(): PersistedShape {
  if (typeof window === "undefined") return { totals: {}, log: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { totals: {}, log: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    return {
      totals:
        parsed.totals && typeof parsed.totals === "object"
          ? (parsed.totals as Record<VerseKey, VerseStats>)
          : {},
      log: Array.isArray(parsed.log) ? (parsed.log as SessionLogEntry[]) : [],
    };
  } catch {
    return { totals: {}, log: [] };
  }
}

function savePersisted() {
  if (typeof window === "undefined") return;
  try {
    const data: PersistedShape = { totals: state.totals, log: state.log };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota / private mode: keep running in-memory only.
  }
}

// ─── Notifications ─────────────────────────────────────────────────────────

function snapshot(): TrackerSnapshot {
  return { current: state.current, totals: state.totals };
}

function notify() {
  const snap = snapshot();
  for (const fn of state.listeners) {
    try {
      fn(snap);
    } catch (err) {
      console.warn("[verseSessions] listener threw:", err);
    }
  }
}

// ─── Activity / tick loop ──────────────────────────────────────────────────

function isActiveNow(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  return Date.now() - state.lastActivityAt < IDLE_THRESHOLD_MS;
}

function onActivity() {
  state.lastActivityAt = Date.now();
}

function tick() {
  const cur = state.current;
  if (!cur) return;
  if (!isActiveNow()) return;
  cur.activeMs += TICK_MS;
  notify();
}

// ─── Runtime setup ─────────────────────────────────────────────────────────

function ensureRuntime() {
  if (state.initialized) return;
  if (typeof window === "undefined") return;
  const persisted = loadPersisted();
  state.totals = persisted.totals;
  state.log = persisted.log;
  state.lastActivityAt = Date.now();

  const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
    "mousemove",
    "mousedown",
    "click",
    "keydown",
    "wheel",
    "touchstart",
    "scroll",
  ];
  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, onActivity, { passive: true });
  }

  // Pause-on-hide / resume-on-show is implicit (isActiveNow rejects),
  // but we also want to flush totals the moment the user tabs away so
  // we don't lose credit on a hard close.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") savePersisted();
    else state.lastActivityAt = Date.now();
  });
  window.addEventListener("beforeunload", () => {
    endSessionInternal();
    savePersisted();
  });

  state.tickHandle = window.setInterval(tick, TICK_MS);
  state.initialized = true;
  notify();
}

// ─── Session lifecycle ─────────────────────────────────────────────────────

/**
 * Begin a new session on `meta`. If an earlier session is open, it is
 * flushed into the rollup + log first. Calling with the same verseKey
 * that's already live is a no-op (prevents double-fires on re-renders).
 */
export function startSession(meta: VerseMeta) {
  ensureRuntime();
  const key = verseKey(meta);
  if (state.current && state.current.verseKey === key) return;
  endSessionInternal();
  state.current = {
    ...meta,
    verseKey: key,
    startedAt: Date.now(),
    activeMs: 0,
  };
  // Kick last-activity so the first tick counts if the user is obviously
  // present (they just navigated — that was a click or a key).
  state.lastActivityAt = Date.now();
  notify();
}

/** End the live session, if any, folding it into totals + log. */
export function endSession() {
  endSessionInternal();
  savePersisted();
  notify();
}

function endSessionInternal() {
  const cur = state.current;
  if (!cur) return;
  // Ignore micro-sessions: under one tick almost certainly means a
  // programmatic double-nav or an auto-clamp (chapter loaded and we
  // snapped verse into range). These aren't real reading time.
  if (cur.activeMs < TICK_MS) {
    state.current = null;
    return;
  }
  const endedAt = Date.now();
  const entry: SessionLogEntry = {
    bookId: cur.bookId,
    chapter: cur.chapter,
    verse: cur.verse,
    verseKey: cur.verseKey,
    startedAt: cur.startedAt,
    endedAt,
    activeMs: cur.activeMs,
  };
  state.log.push(entry);
  if (state.log.length > LOG_CAP) {
    state.log.splice(0, state.log.length - LOG_CAP);
  }
  const prev = state.totals[cur.verseKey];
  state.totals[cur.verseKey] = {
    bookId: cur.bookId,
    chapter: cur.chapter,
    verse: cur.verse,
    totalMs: (prev?.totalMs ?? 0) + cur.activeMs,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
    lastVisitedAt: endedAt,
  };
  state.current = null;
  savePersisted();
}

// ─── Read API ──────────────────────────────────────────────────────────────

/** Subscribe to tracker changes. Returns an unsubscribe fn. */
export function subscribe(fn: (snap: TrackerSnapshot) => void): () => void {
  ensureRuntime();
  state.listeners.add(fn);
  fn(snapshot());
  return () => {
    state.listeners.delete(fn);
  };
}

/** Current snapshot without subscribing. Useful for one-shot reads. */
export function getSnapshot(): TrackerSnapshot {
  ensureRuntime();
  return snapshot();
}

/** Total active ms on a given verse (including the live session). */
export function getVerseTotalMs(key: VerseKey): number {
  const rolled = state.totals[key]?.totalMs ?? 0;
  const live =
    state.current && state.current.verseKey === key
      ? state.current.activeMs
      : 0;
  return rolled + live;
}

/**
 * All verses we have any data on, with the live session folded in.
 * Sorted newest-first by `lastVisitedAt` (current session pinned first).
 */
export function getAllVerseStats(): VerseStats[] {
  const out: Record<VerseKey, VerseStats> = { ...state.totals };
  const cur = state.current;
  if (cur && cur.activeMs > 0) {
    const existing = out[cur.verseKey];
    out[cur.verseKey] = {
      bookId: cur.bookId,
      chapter: cur.chapter,
      verse: cur.verse,
      totalMs: (existing?.totalMs ?? 0) + cur.activeMs,
      sessionCount: (existing?.sessionCount ?? 0) + 1,
      lastVisitedAt: Date.now(),
    };
  }
  return Object.values(out).sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
}

/** Wipe all persisted sessions. No-op on SSR. */
export function clearAllSessions() {
  state.totals = {};
  state.log = [];
  state.current = null;
  savePersisted();
  notify();
}

// ─── Formatting ────────────────────────────────────────────────────────────

/**
 * Format a duration as `m:ss` under an hour, `h:mm:ss` otherwise. We
 * never display "0:00" — the callers guard on `ms > 0`.
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
