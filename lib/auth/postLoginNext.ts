/** Cookie used to remember the post-login path across the OAuth/magic-link round trip. */
export const AUTH_NEXT_COOKIE = "auth_next";

const COOKIE_MAX_AGE_SEC = 600;

/** Only allow same-origin relative paths after sign-in. */
export function safePostLoginPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/** Client: persist intended destination before redirecting to Supabase. */
export function setAuthNextCookie(next: string): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(safePostLoginPath(next));
  document.cookie = `${AUTH_NEXT_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

/** Server: query param wins; cookie covers OAuth when redirect URL has no search params. */
export function resolvePostLoginPath(
  fromQuery: string | null,
  fromCookie: string | undefined,
): string {
  if (fromQuery) return safePostLoginPath(fromQuery);
  if (!fromCookie) return "/";
  try {
    return safePostLoginPath(decodeURIComponent(fromCookie));
  } catch {
    return safePostLoginPath(fromCookie);
  }
}
