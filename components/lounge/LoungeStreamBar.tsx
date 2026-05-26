"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { isLiveKitConfigured } from "@/lib/lounge/env";
import { useLoungeBarHeight } from "@/lib/lounge/useLoungeBarHeight";
import { useLounge } from "./LoungeProvider";
import { LoungeBarResizeHandle } from "./LoungeBarResizeHandle";
import { LoungeVideoRoom } from "./LoungeVideoRoom";
import { LoungeInvitePanel } from "./LoungeInvitePanel";

const loungeBarLabelClass =
  "inline-flex h-6 items-center gap-1.5 text-[10px] font-semibold uppercase leading-none tracking-widest text-white/90";

const loungeBarActionClass =
  "inline-flex h-6 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent px-2 text-[10px] font-semibold uppercase leading-none tracking-widest text-white/80 hover:bg-white/10";

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
  const { tileHeight, barHeight, resizeBar } = useLoungeBarHeight();
  const [showInvite, setShowInvite] = useState(false);
  const inviteAnchorRef = useRef<HTMLButtonElement>(null);

  if (!enabled) return null;

  const livekitOk = session?.livekitConfigured ?? isLiveKitConfigured();
  const isOwnLounge =
    !!session && (!activeRoomName || activeRoomName === session.roomName);

  return (
    <div
      className="shrink-0 overflow-visible border-b border-white/10 bg-[var(--color-ink)] text-white"
      style={{ height: barHeight }}
      role="region"
      aria-label="Lounge live stream"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="relative z-30 flex h-8 shrink-0 items-center justify-between gap-2 overflow-visible px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={loungeBarLabelClass}>
              <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
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
          <div className="flex h-6 shrink-0 items-center gap-1">
            {isOwnLounge && (
              <>
                <button
                  ref={inviteAnchorRef}
                  type="button"
                  onClick={() => setShowInvite((v) => !v)}
                  className={loungeBarActionClass}
                  aria-expanded={showInvite}
                >
                  Invite
                </button>
                <LoungeInvitePanel
                  anchorRef={inviteAnchorRef}
                  open={showInvite}
                  onClose={() => setShowInvite(false)}
                />
              </>
            )}
            <Link
              href="/settings"
              className={`max-sm:hidden ${loungeBarActionClass}`}
            >
              Guests
            </Link>
            <button
              type="button"
              onClick={disable}
              className={loungeBarActionClass}
              title="Leave lounge and hide the stream bar"
            >
              End
            </button>
          </div>
        </div>

        <div
          className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-visible"
          style={{ minHeight: tileHeight + 8 }}
        >
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
              tileHeightPx={tileHeight}
            />
          )}
          {!sessionLoading && livekitOk && !activeRoomName && (
            <div className="flex h-full items-center px-3 text-xs text-white/50">
              Sign in to start your lounge.
            </div>
          )}
        </div>
        <LoungeBarResizeHandle onResize={resizeBar} />
      </div>
    </div>
  );
}
