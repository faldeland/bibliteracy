"use client";

import { useLocalParticipant } from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { resolveCameraTrackRef } from "@/lib/lounge/loungeTrackRefs";
import { useEffect, useRef } from "react";
import { LoungeLocalTileControls } from "./LoungeLocalTileControls";

interface LoungeParticipantVideoProps {
  trackRef: TrackReferenceOrPlaceholder;
}

/**
 * Renders camera video in the lounge bar. Uses explicit track.attach so video
 * still plays when the track is published before the <video> element mounts
 * (a common cause of a black tile with working mic/camera toggles).
 */
export function LoungeParticipantVideo({ trackRef }: LoungeParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { localParticipant, cameraTrack, isCameraEnabled } =
    useLocalParticipant();
  const resolved = resolveCameraTrackRef(trackRef, {
    participant: localParticipant,
    cameraTrack,
    isCameraEnabled,
  });
  const mediaTrack = resolved?.publication?.track;
  const trackSid = resolved?.publication?.trackSid;
  const isLocal = trackRef.participant.isLocal;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !mediaTrack) return;
    mediaTrack.attach(el);
    void el.play().catch(() => {
      /* autoplay policy; user already interacted via camera toggle */
    });
    return () => {
      mediaTrack.detach(el);
    };
  }, [mediaTrack, trackSid]);

  if (!resolved || !mediaTrack) {
    return (
      <div className="relative h-full w-full">
        <div className="flex h-full w-full items-center justify-center bg-black/60 text-[10px] text-white/50">
          Camera off
        </div>
        {isLocal ? <LoungeLocalTileControls /> : null}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="lounge-participant-video absolute inset-0 h-full w-full object-cover"
        data-lk-local-participant={isLocal ? "" : undefined}
      />
      {isLocal ? <LoungeLocalTileControls /> : null}
    </div>
  );
}
