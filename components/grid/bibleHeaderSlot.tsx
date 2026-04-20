"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

// A tiny slot mechanism so `BibleReader` (which owns all the
// verse/translation state) can render its search bar + version-picker
// button up inside the global `TopNav`, right next to the brand.
// Using a React-portal target instead of lifting all the state up keeps
// the BibleReader refactor small and avoids threading a dozen callbacks.

type Ctx = {
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
};

const BibleHeaderSlotCtx = createContext<Ctx>({ el: null, setEl: () => {} });

export function BibleHeaderSlotProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <BibleHeaderSlotCtx.Provider value={{ el, setEl }}>
      {children}
    </BibleHeaderSlotCtx.Provider>
  );
}

/** Target element for `createPortal` in consumers (null until the slot mounts). */
export function useBibleHeaderSlotTarget(): HTMLElement | null {
  return useContext(BibleHeaderSlotCtx).el;
}

/** Renders the DOM node that `BibleReader` will portal its controls into. */
export function BibleHeaderSlot({ className }: { className?: string }) {
  const { setEl } = useContext(BibleHeaderSlotCtx);
  return <div ref={setEl} className={className} />;
}
