/** True when the browser can reach a LiveKit Cloud deployment. */
export function isLiveKitConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_LIVEKIT_URL;
}
