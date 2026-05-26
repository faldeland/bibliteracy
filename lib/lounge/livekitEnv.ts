/**
 * WebSocket URL for LiveKit Cloud. Prefer `NEXT_PUBLIC_LIVEKIT_URL` so the
 * browser bundle and `/api/livekit/token` agree; `LIVEKIT_URL` is a server-only
 * fallback for local `.env` files that omit the public name.
 */
function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function livekitWsUrl(): string | undefined {
  return trimEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL) ?? trimEnv(process.env.LIVEKIT_URL);
}

export function livekitApiKey(): string | undefined {
  return trimEnv(process.env.LIVEKIT_API_KEY);
}

export function livekitApiSecret(): string | undefined {
  return trimEnv(process.env.LIVEKIT_API_SECRET);
}

export function isLiveKitServerConfigured(): boolean {
  return !!(livekitApiKey() && livekitApiSecret() && livekitWsUrl());
}

/** True when URL or keys are still the `.env.example` placeholders. */
export function isLiveKitPlaceholderConfig(): boolean {
  const url = livekitWsUrl() ?? "";
  const key = livekitApiKey() ?? "";
  const secret = livekitApiSecret() ?? "";
  return (
    url.includes("your-project.livekit.cloud") ||
    key.startsWith("PASTE_") ||
    key.startsWith("your-") ||
    secret.startsWith("PASTE_") ||
    secret.startsWith("your-")
  );
}
