"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { isTrackReference } from "@livekit/components-core";
import { MediaDeviceFailure, Track } from "livekit-client";
import "@livekit/components-styles";
import { useMemo, useState } from "react";
import {
  LOUNGE_TILE_HEIGHT_DEFAULT_PX,
  loungeTileWidthPx,
} from "@/lib/lounge/loungeBarLayout";
import { preferPublishedCameraTracks } from "@/lib/lounge/loungeTrackRefs";
import { useLiveKitToken } from "@/lib/lounge/useLiveKitToken";
import { LoungeMediaControls } from "./LoungeMediaControls";
import { LoungeParticipantVideo } from "./LoungeParticipantVideo";

interface LoungeVideoRoomProps {
  roomName: string;
  displayName?: string;
  layout: "full" | "bar";
  /** Bar layout only; participant tile height in px. */
  tileHeightPx?: number;
}

export function LoungeVideoRoom({
  roomName,
  displayName,
  layout,
  tileHeightPx = LOUNGE_TILE_HEIGHT_DEFAULT_PX,
}: LoungeVideoRoomProps) {
  const { token, serverUrl, error, ready, loading } = useLiveKitToken(
    roomName,
    displayName,
  );
  const [connectError, setConnectError] = useState<string | null>(null);

  if (error) {
    return (
      <div
        className={
          layout === "bar"
            ? "flex h-full items-center px-3 text-xs text-amber-200"
            : "rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        }
      >
        Live unavailable: {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        className={
          layout === "bar"
            ? "flex h-full items-center px-3 text-xs text-white/60"
            : "flex h-full items-center justify-center text-sm text-[var(--color-ink-2)]"
        }
      >
        {loading ? "Connecting…" : "Waiting for session…"}
      </div>
    );
  }

  if (connectError) {
    return (
      <div
        className={
          layout === "bar"
            ? "flex h-full items-center px-3 text-xs text-amber-200"
            : "rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        }
      >
        Live unavailable: {connectError}
      </div>
    );
  }

  return (
    <LiveKitRoom
      data-lk-theme="default"
      token={token!}
      serverUrl={serverUrl!}
      connect
      onConnected={() => setConnectError(null)}
      onError={(e) => setConnectError(e.message)}
      onMediaDeviceFailure={(failure) => {
        if (failure === MediaDeviceFailure.PermissionDenied) {
          console.warn("[lounge] camera/microphone permission denied");
        }
      }}
      className={
        layout === "bar"
          ? "lounge-livekit h-full min-h-0 overflow-visible"
          : "lounge-livekit h-full overflow-visible"
      }
    >
      <RoomAudioRenderer />
      <ConnectionStateToast />
      {layout === "bar" ? (
        <BarStage tileHeightPx={tileHeightPx} />
      ) : (
        <FullStage />
      )}
    </LiveKitRoom>
  );
}

function BarStage({ tileHeightPx }: { tileHeightPx: number }) {
  const rawTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const tracks = useMemo(
    () => preferPublishedCameraTracks(rawTracks),
    [rawTracks],
  );
  const tileWidthPx = loungeTileWidthPx(tileHeightPx);

  return (
    <div className="flex h-full min-h-0 min-w-0 items-center gap-2 overflow-x-hidden overflow-y-visible">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden px-1"
        style={{ height: tileHeightPx }}
      >
        {tracks.map((track) => (
          <div
            key={track.participant.identity + track.source}
            className="relative shrink-0 overflow-hidden rounded-md bg-black"
            style={{ height: tileHeightPx, width: tileWidthPx }}
          >
            <LoungeParticipantVideo trackRef={track} />
          </div>
        ))}
      </div>
      <div
        className="relative z-20 flex shrink-0 items-center overflow-visible border-l border-white/10 pl-2 pr-1"
        style={{ height: tileHeightPx, minWidth: "9.5rem" }}
      >
        <LoungeMediaControls layout="bar" tileHeightPx={tileHeightPx} />
      </div>
    </div>
  );
}

function FullStage() {
  const rawTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const tracks = useMemo(() => {
    const cameras = preferPublishedCameraTracks(
      rawTracks.filter((t) => t.source === Track.Source.Camera),
    );
    const screens = rawTracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    return [...cameras, ...screens];
  }, [rawTracks]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-auto p-2">
        {tracks.map((track) => (
          <div
            key={track.participant.identity + track.source}
            className="relative h-40 w-56 overflow-hidden rounded-lg bg-black/30"
          >
            {track.source === Track.Source.ScreenShare &&
            isTrackReference(track) ? (
              <VideoTrack
                key={track.publication.trackSid}
                trackRef={track}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <LoungeParticipantVideo trackRef={track} />
            )}
          </div>
        ))}
      </div>
      <LoungeMediaControls layout="full" />
    </div>
  );
}
