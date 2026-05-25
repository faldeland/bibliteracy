import {
  BIBLE_READER_KJV_DEFAULT_PX,
  BIBLE_READER_PASSAGE_DEFAULT_PX,
  clampKjvPanelHeight,
  clampPassagePanelHeight,
} from "@/lib/grid/bibleReaderLayout";

export const BIBLE_READER_PASSAGE_HEIGHT_KEY =
  "bibliteracy:bible:passagePanelHeight";

export const BIBLE_READER_KJV_HEIGHT_KEY = "bibliteracy:bible:kjvPanelHeight";

export function readStoredPassagePanelHeight(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BIBLE_READER_PASSAGE_HEIGHT_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clampPassagePanelHeight(n) : null;
}

export function readStoredKjvPanelHeight(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BIBLE_READER_KJV_HEIGHT_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clampKjvPanelHeight(n) : null;
}

export {
  BIBLE_READER_KJV_DEFAULT_PX,
  BIBLE_READER_PASSAGE_DEFAULT_PX,
  clampKjvPanelHeight,
  clampPassagePanelHeight,
};
