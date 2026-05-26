/** True when the browser bundle includes a LiveKit WebSocket URL. */
export function isLiveKitConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_LIVEKIT_URL;
}
