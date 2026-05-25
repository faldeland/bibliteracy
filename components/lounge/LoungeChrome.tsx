"use client";

import { LoungeStreamBar } from "./LoungeStreamBar";

/**
 * Renders the lounge stream bar above page content when enabled so the grid,
 * atlas, and other routes stay usable while on a live call.
 */
export function LoungeChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <LoungeStreamBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
