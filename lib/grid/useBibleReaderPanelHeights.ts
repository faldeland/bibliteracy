"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BIBLE_READER_KJV_DEFAULT_PX,
  BIBLE_READER_KJV_HEIGHT_KEY,
  BIBLE_READER_PASSAGE_DEFAULT_PX,
  BIBLE_READER_PASSAGE_HEIGHT_KEY,
  clampKjvPanelHeight,
  clampPassagePanelHeight,
  readStoredKjvPanelHeight,
  readStoredPassagePanelHeight,
} from "@/lib/grid/bibleReaderHeights";

export function useBibleReaderPanelHeights(showKjvParallel: boolean) {
  const [passageHeight, setPassageHeight] = useState(
    BIBLE_READER_PASSAGE_DEFAULT_PX,
  );
  const [kjvHeight, setKjvHeight] = useState(BIBLE_READER_KJV_DEFAULT_PX);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const storedPassage = readStoredPassagePanelHeight();
    const storedKjv = readStoredKjvPanelHeight();
    if (storedPassage != null) setPassageHeight(storedPassage);
    if (storedKjv != null) setKjvHeight(storedKjv);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(
      BIBLE_READER_PASSAGE_HEIGHT_KEY,
      String(passageHeight),
    );
  }, [passageHeight]);

  useEffect(() => {
    if (!hydratedRef.current || !showKjvParallel) return;
    window.localStorage.setItem(BIBLE_READER_KJV_HEIGHT_KEY, String(kjvHeight));
  }, [kjvHeight, showKjvParallel]);

  const resizePassage = useCallback((deltaY: number) => {
    setPassageHeight((h) => clampPassagePanelHeight(h + deltaY));
  }, []);

  const resizeKjv = useCallback((deltaY: number) => {
    setKjvHeight((h) => clampKjvPanelHeight(h + deltaY));
  }, []);

  const sectionHeightPx =
    passageHeight + (showKjvParallel ? kjvHeight : 0);

  return {
    passageHeight,
    kjvHeight,
    sectionHeightPx,
    resizePassage,
    resizeKjv,
  };
}
