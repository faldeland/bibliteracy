"use client";

import {
  ControlBar,
  MediaDeviceMenu,
  TrackToggle,
  useConnectionState,
  useLocalParticipant,
  useMediaDeviceSelect,
  usePersistentUserChoices,
  type ControlBarControls,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useCallback, useState } from "react";

type LoungeMediaControlsProps = {
  layout: "bar" | "full";
  /** Bar layout: hide inline device lists when the tile row is very short. */
  tileHeightPx?: number;
};

export function LoungeMediaControls({
  layout,
  tileHeightPx,
}: LoungeMediaControlsProps) {
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const connectionState = useConnectionState();

  const onDeviceError = useCallback(
    ({ source, error }: { source: Track.Source; error: Error }) => {
      const name =
        source === Track.Source.Microphone
          ? "Microphone"
          : source === Track.Source.Camera
            ? "Camera"
            : "Media";
      setDeviceError(`${name}: ${error.message}`);
    },
    [],
  );

  if (
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting
  ) {
    return (
      <span className="text-[10px] text-white/50" aria-live="polite">
        Connecting…
      </span>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <span
        className="max-w-[12rem] text-[10px] leading-snug text-amber-200"
        aria-live="polite"
      >
        Live disconnected. Check LiveKit env vars and refresh.
      </span>
    );
  }

  return (
    <div className="lounge-media-controls relative flex shrink-0 flex-col gap-1 overflow-visible">
      {deviceError ? (
        <p
          className="absolute bottom-full right-0 z-[100] mb-1 max-w-[16rem] rounded border border-amber-500/40 bg-amber-950 px-2 py-1 text-[10px] leading-snug text-amber-100 shadow-lg"
          role="alert"
        >
          {deviceError}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setDeviceError(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}
      {layout === "bar" ? (
        <BarControls
          tileHeightPx={tileHeightPx}
          onDeviceError={onDeviceError}
        />
      ) : (
        <ControlBar
          variation="verbose"
          controls={fullControls}
          onDeviceError={onDeviceError}
        />
      )}
    </div>
  );
}

const fullControls: ControlBarControls = {
  screenShare: true,
  chat: false,
  settings: false,
  leave: false,
};

function BarControls({
  tileHeightPx,
  onDeviceError,
}: {
  tileHeightPx?: number;
  onDeviceError: (error: { source: Track.Source; error: Error }) => void;
}) {
  const showInlineSelects = (tileHeightPx ?? 88) >= 72;
  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices();
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const canEnumerate = isMicrophoneEnabled || isCameraEnabled;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="lk-control-bar !max-h-none shrink-0 !border-0 !p-0">
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon
            onChange={(enabled, isUserInitiated) =>
              isUserInitiated ? saveAudioInputEnabled(enabled) : null
            }
            onDeviceError={(error) =>
              onDeviceError({ source: Track.Source.Microphone, error })
            }
          />
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              requestPermissions={canEnumerate}
              onActiveDeviceChange={(_kind, deviceId) =>
                saveAudioInputDeviceId(deviceId ?? "default")
              }
            />
          </div>
        </div>
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon
            onChange={(enabled, isUserInitiated) =>
              isUserInitiated ? saveVideoInputEnabled(enabled) : null
            }
            onDeviceError={(error) =>
              onDeviceError({ source: Track.Source.Camera, error })
            }
          />
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              requestPermissions={canEnumerate}
              onActiveDeviceChange={(_kind, deviceId) =>
                saveVideoInputDeviceId(deviceId ?? "default")
              }
            />
          </div>
        </div>
      </div>
      {showInlineSelects ? (
        <div className="flex min-w-0 max-w-[14rem] flex-col gap-0.5">
          <LoungeDeviceSelect
            kind="audioinput"
            label="Microphone"
            requestPermissions={canEnumerate}
            onActiveDeviceChange={(deviceId) =>
              saveAudioInputDeviceId(deviceId ?? "default")
            }
          />
          <LoungeDeviceSelect
            kind="videoinput"
            label="Camera"
            requestPermissions={canEnumerate}
            onActiveDeviceChange={(deviceId) =>
              saveVideoInputDeviceId(deviceId ?? "default")
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function LoungeDeviceSelect({
  kind,
  label,
  requestPermissions,
  onActiveDeviceChange,
}: {
  kind: MediaDeviceKind;
  label: string;
  requestPermissions: boolean;
  onActiveDeviceChange: (deviceId: string) => void;
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind,
    requestPermissions,
  });

  return (
    <label className="flex min-w-0 items-center gap-1 text-[10px] text-white/70">
      <span className="w-7 shrink-0 truncate uppercase tracking-wide">
        {kind === "audioinput" ? "Mic" : "Cam"}
      </span>
      <select
        className="min-w-0 flex-1 truncate rounded border border-white/20 bg-black/40 px-1 py-0.5 text-[10px] text-white outline-none focus:border-white/40"
        value={activeDeviceId}
        onChange={(e) => {
          const id = e.target.value;
          setActiveMediaDevice(id);
          onActiveDeviceChange(id);
        }}
        aria-label={`${label} source`}
        disabled={devices.length === 0}
      >
        {devices.length === 0 ? (
          <option value="">
            {requestPermissions ? "No devices" : "Enable track to list"}
          </option>
        ) : (
          devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} (${d.deviceId.slice(0, 6)}…)`}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
