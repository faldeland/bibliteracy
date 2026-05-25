"use client";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isLiveKitConfigured } from "@/lib/lounge/env";
import { useLoungeOptional } from "./LoungeProvider";

export function LoungeToggle({ className = "" }: { className?: string }) {
  const lounge = useLoungeOptional();
  if (!lounge || !isSupabaseConfigured()) return null;

  const { enabled, toggle, sessionLoading } = lounge;
  const canLive = isLiveKitConfigured();

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={sessionLoading && enabled}
      title={
        enabled
          ? "Hide lounge stream bar"
          : canLive
            ? "Open lounge — live video while you browse"
            : "Open lounge (configure LiveKit for video)"
      }
      className={
        "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-widest " +
        (enabled
          ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
          : "text-[var(--color-ink-2)] hover:bg-black/5") +
        (className ? ` ${className}` : "")
      }
    >
      {enabled ? "Lounge · live" : "Lounge"}
    </button>
  );
}
