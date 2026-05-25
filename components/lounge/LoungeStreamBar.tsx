"use client";

import { useState } from "react";
import Link from "next/link";
import { isLiveKitConfigured } from "@/lib/lounge/env";
import { useLounge } from "./LoungeProvider";
import { LoungeVideoRoom } from "./LoungeVideoRoom";
import { LoungeInvitePanel } from "./LoungeInvitePanel";

/** Height reserved above page content when the lounge bar is open. */
export const LOUNGE_BAR_HEIGHT_PX = 120;

export function LoungeStreamBar() {
  const {
    enabled,
    session,
    sessionLoading,
    activeRoomName,
    activeDisplayName,
    setActiveHostRoom,
    disable,
  } = useLounge();
  const [showInvite, setShowInvite] = useState(false);

  if (!enabled) return null;

  const livekitOk = session?.livekitConfigured ?? isLiveKitConfigured();
  const isOwnLounge =
    !!session && (!activeRoomName || activeRoomName === session.roomName);

  return (
    <div
      className="shrink-0 border-b border-white/10 bg-[var(--color-ink)] text-white"
      style={{ height: LOUNGE_BAR_HEIGHT_PX }}
      role="region"
      aria-label="Lounge live stream"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/90">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              Lounge
            </span>
            {session?.hostLounges && session.hostLounges.length > 0 && (
              <select
                value={activeRoomName ?? session.roomName}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === session.roomName) setActiveHostRoom(null);
                  else setActiveHostRoom(v);
                }}
                className="max-w-[14rem] truncate rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[10px] text-white outline-none"
              >
                <option value={session.roomName}>My lounge</option>
                {session.hostLounges.map((h) => (
                  <option key={h.roomName} value={h.roomName}>
                    {h.ownerName}&apos;s lounge
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isOwnLounge && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowInvite((v) => !v)}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/80 hover:bg-white/10"
                >
                  Invite
                </button>
                {showInvite && (
                  <LoungeInvitePanel onClose={() => setShowInvite(false)} />
                )}
              </div>
            )}
            <Link
              href="/settings"
              className="hidden rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/60 hover:bg-white/10 sm:inline"
            >
              Guests
            </Link>
            <button
              type="button"
              onClick={disable}
              className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/60 hover:bg-white/10"
              title="Leave lounge and hide the stream bar"
            >
              End
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {sessionLoading && (
            <div className="flex h-full items-center px-3 text-xs text-white/50">
              Loading lounge…
            </div>
          )}
          {!sessionLoading && !livekitOk && (
            <div className="flex h-full items-center gap-2 px-3 text-xs text-amber-200/90">
              LiveKit is not configured. Add keys from{" "}
              <code className="text-[10px]">.env.example</code> and restart.
            </div>
          )}
          {!sessionLoading && livekitOk && activeRoomName && (
            <LoungeVideoRoom
              roomName={activeRoomName}
              displayName={activeDisplayName ?? undefined}
              layout="bar"
            />
          )}
          {!sessionLoading && livekitOk && !activeRoomName && (
            <div className="flex h-full items-center px-3 text-xs text-white/50">
              Sign in to start your lounge.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
