import { isLiveKitPublicUrlConfigured } from "@/lib/lounge/livekitEnv";

/** True when the browser bundle includes a real LiveKit WebSocket URL. */
export function isLiveKitConfigured(): boolean {
  return isLiveKitPublicUrlConfigured();
}
