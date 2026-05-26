"use client";

import {
  TrackToggle,
  usePersistentUserChoices,
} from "@livekit/components-react";
import { Track } from "livekit-client";

/**
 * Mic/camera toggles on the local participant's video tile (thumbnail).
 * Uses the same publish toggles as the bar control strip.
 */
export function LoungeLocalTileControls() {
  const { saveAudioInputEnabled, saveVideoInputEnabled } =
    usePersistentUserChoices();

  return (
    <div
      className="lounge-local-tile-controls pointer-events-auto absolute bottom-px right-px z-10 flex gap-px"
      role="group"
      aria-label="Your microphone and camera"
    >
      <TrackToggle
        source={Track.Source.Microphone}
        showIcon
        className="lounge-tile-track-toggle"
        onChange={(enabled, isUserInitiated) =>
          isUserInitiated ? saveAudioInputEnabled(enabled) : null
        }
      />
      <TrackToggle
        source={Track.Source.Camera}
        showIcon
        className="lounge-tile-track-toggle"
        onChange={(enabled, isUserInitiated) =>
          isUserInitiated ? saveVideoInputEnabled(enabled) : null
        }
      />
    </div>
  );
}
