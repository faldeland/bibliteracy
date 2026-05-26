import { describe, expect, it } from "vitest";
import {
  preferPublishedCameraTracks,
  resolveCameraTrackRef,
} from "@/lib/lounge/loungeTrackRefs";
import { Track } from "livekit-client";
import type { LocalParticipant, TrackPublication } from "livekit-client";

describe("preferPublishedCameraTracks", () => {
  it("keeps published track over placeholder for same participant", () => {
    const participant = { identity: "u_1", isLocal: true } as never;
    const placeholder = { participant, source: Track.Source.Camera };
    const published = {
      participant,
      source: Track.Source.Camera,
      publication: {} as TrackPublication,
    };
    const result = preferPublishedCameraTracks([placeholder, published]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(published);
  });
});

describe("resolveCameraTrackRef", () => {
  it("resolves local placeholder when camera publication exists", () => {
    const participant = { identity: "u_1", isLocal: true } as LocalParticipant;
    const publication = { trackSid: "t1" } as TrackPublication;
    const placeholder = { participant, source: Track.Source.Camera };
    const resolved = resolveCameraTrackRef(placeholder, {
      participant,
      cameraTrack: publication,
      isCameraEnabled: true,
    });
    expect(resolved?.publication).toBe(publication);
  });
});
