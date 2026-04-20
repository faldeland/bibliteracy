"use client";

import { useEffect, useState } from "react";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

interface RoomEmbedProps {
  roomName: string;
  displayName?: string;
}

export function RoomEmbed({ roomName, displayName }: RoomEmbedProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomName, name: displayName }),
      });
      if (cancelled) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { token: string; url: string };
      setToken(json.token);
      setServerUrl(json.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName, displayName]);

  if (error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Live unavailable: {error}
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-2)]">
        Connecting to room…
      </div>
    );
  }

  return (
    <LiveKitRoom
      data-lk-theme="default"
      token={token}
      serverUrl={serverUrl}
      connect={connect || true}
      audio
      video
      className="h-full"
      onConnected={() => setConnect(true)}
      onDisconnected={() => setConnect(false)}
    >
      <RoomAudioRenderer />
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">
          <Stage />
        </div>
        <ControlBar variation="verbose" />
      </div>
    </LiveKitRoom>
  );
}

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} className="h-full">
      <ParticipantTile />
    </GridLayout>
  );
}
