"use client";

import {
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import { useLiveKitToken } from "@/lib/lounge/useLiveKitToken";

interface LoungeVideoRoomProps {
  roomName: string;
  displayName?: string;
  layout: "full" | "bar";
}

export function LoungeVideoRoom({
  roomName,
  displayName,
  layout,
}: LoungeVideoRoomProps) {
  const { token, serverUrl, error, ready } = useLiveKitToken(
    roomName,
    displayName,
  );

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
        Connecting…
      </div>
    );
  }

  return (
    <LiveKitRoom
      data-lk-theme="default"
      token={token!}
      serverUrl={serverUrl!}
      connect
      audio
      video
      className={layout === "bar" ? "h-full" : "h-full"}
    >
      <RoomAudioRenderer />
      {layout === "bar" ? <BarStage /> : <FullStage />}
    </LiveKitRoom>
  );
}

function BarStage() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  return (
    <div className="flex h-full min-w-0 flex-1 items-stretch gap-2">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
        {tracks.map((track) => (
          <div
            key={track.participant.identity + track.source}
            className="relative h-[88px] w-[132px] shrink-0 overflow-hidden rounded-md bg-black/40"
          >
            <ParticipantTile trackRef={track} className="h-full w-full" />
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center border-l border-white/10 pl-1">
        <ControlBar
          variation="minimal"
          controls={{
            camera: true,
            microphone: true,
            screenShare: false,
            chat: false,
            settings: false,
            leave: false,
          }}
        />
      </div>
    </div>
  );
}

function FullStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-auto p-2">
        {tracks.map((track) => (
          <div
            key={track.participant.identity + track.source}
            className="relative h-40 w-56 overflow-hidden rounded-lg bg-black/30"
          >
            <ParticipantTile trackRef={track} className="h-full w-full" />
          </div>
        ))}
      </div>
      <ControlBar variation="verbose" />
    </div>
  );
}
