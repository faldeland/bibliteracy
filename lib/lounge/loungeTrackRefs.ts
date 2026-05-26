import {
  isTrackReference,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-core";
import type { LocalParticipant, TrackPublication } from "livekit-client";
import { Track } from "livekit-client";

/** Prefer a published track over a placeholder for the same participant + source. */
export function preferPublishedCameraTracks(
  refs: TrackReferenceOrPlaceholder[],
): TrackReferenceOrPlaceholder[] {
  const byKey = new Map<string, TrackReferenceOrPlaceholder>();
  for (const ref of refs) {
    const key = `${ref.participant.identity}:${ref.source}`;
    const existing = byKey.get(key);
    if (!existing || (!isTrackReference(existing) && isTrackReference(ref))) {
      byKey.set(key, ref);
    }
  }
  return [...byKey.values()];
}

/**
 * LiveKit may still return a camera placeholder while the local publication
 * exists; resolve to the real publication so video can attach.
 */
export function resolveCameraTrackRef(
  trackRef: TrackReferenceOrPlaceholder,
  local: {
    participant: LocalParticipant;
    cameraTrack: TrackPublication | undefined;
    isCameraEnabled: boolean;
  },
): TrackReference | null {
  if (isTrackReference(trackRef)) {
    return trackRef;
  }
  if (
    trackRef.source === Track.Source.Camera &&
    trackRef.participant.isLocal &&
    local.isCameraEnabled &&
    local.cameraTrack
  ) {
    return {
      participant: local.participant,
      publication: local.cameraTrack,
      source: Track.Source.Camera,
    };
  }
  return null;
}
