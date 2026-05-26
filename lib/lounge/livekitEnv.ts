/**
 * WebSocket URL for LiveKit Cloud. Prefer `NEXT_PUBLIC_LIVEKIT_URL` so the
 * browser bundle and `/api/livekit/token` agree; `LIVEKIT_URL` is a server-only
 * fallback for deployments that set only the private name (e.g. Vercel env).
 */
function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

const PLACEHOLDER_URL_HOST = "your-project.livekit.cloud";

function isPlaceholderUrl(url: string | undefined): boolean {
  return !url || url.includes(PLACEHOLDER_URL_HOST);
}

function isPlaceholderCredential(value: string | undefined): boolean {
  return !value || value.startsWith("PASTE_") || value.startsWith("your-");
}

/** True when `NEXT_PUBLIC_LIVEKIT_URL` is set and not an `.env.example` placeholder. */
export function isLiveKitPublicUrlConfigured(): boolean {
  const pub = trimEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  return !!pub && !isPlaceholderUrl(pub);
}

/**
 * Effective WebSocket URL for the token route. Skips a placeholder
 * `NEXT_PUBLIC_LIVEKIT_URL` when `LIVEKIT_URL` has a real value.
 */
export function livekitWsUrl(): string | undefined {
  const pub = trimEnv(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const priv = trimEnv(process.env.LIVEKIT_URL);
  if (pub && !isPlaceholderUrl(pub)) return pub;
  if (priv && !isPlaceholderUrl(priv)) return priv;
  return pub ?? priv;
}

export function livekitApiKey(): string | undefined {
  return trimEnv(process.env.LIVEKIT_API_KEY);
}

export function livekitApiSecret(): string | undefined {
  return trimEnv(process.env.LIVEKIT_API_SECRET);
}

export function isLiveKitServerConfigured(): boolean {
  const url = livekitWsUrl();
  const key = livekitApiKey();
  const secret = livekitApiSecret();
  return (
    !!url &&
    !!key &&
    !!secret &&
    !isPlaceholderUrl(url) &&
    !isPlaceholderCredential(key) &&
    !isPlaceholderCredential(secret)
  );
}

/** True when any LiveKit env is set but still invalid or `.env.example` placeholders. */
export function isLiveKitPlaceholderConfig(): boolean {
  const url = livekitWsUrl() ?? "";
  const key = livekitApiKey() ?? "";
  const secret = livekitApiSecret() ?? "";
  if (!url && !key && !secret) return false;
  return (
    isPlaceholderUrl(url) ||
    isPlaceholderCredential(key) ||
    isPlaceholderCredential(secret)
  );
}

export const LIVEKIT_SETUP_HINT =
  "Set NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in your deployment environment (Vercel → Project Settings → Environment Variables), then redeploy. Values come from cloud.livekit.io.";
