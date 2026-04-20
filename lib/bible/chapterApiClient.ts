import type { ParsedVerse } from "./bollsApi";

/**
 * Prefix for API paths when the app uses `basePath` (must match
 * `next.config` and be set as NEXT_PUBLIC_BASE_PATH so the client can call
 * the same origin’s API routes).
 */
export function bibleApiPath(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Shape of JSON from GET /api/bible/chapter (success or error payload). */
export interface ChapterApiResponse {
  book: string;
  chapter: number;
  translation?: string;
  attribution?: string | null;
  verses?: ParsedVerse[];
  error?: string;
  configMissing?: string;
}

function isLikelyNetworkFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower === "load failed" ||
    lower.includes("networkerror") ||
    lower.includes("network request failed")
  );
}

/**
 * Browser-only fetch for chapter text. Surfaces clearer messages when the
 * browser cannot complete the request (dev server down, wrong host/port,
 * VPN/firewall) vs when the API returns a structured error JSON.
 */
export async function fetchChapterFromApi(
  bookId: string,
  chapter: number,
  translationId: string,
  signal?: AbortSignal,
): Promise<ChapterApiResponse> {
  const url = bibleApiPath(
    `/api/bible/chapter?book=${encodeURIComponent(bookId)}&chapter=${chapter}&translation=${encodeURIComponent(translationId)}`,
  );
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    const msg = e instanceof Error ? e.message : String(e);
    if (isLikelyNetworkFailure(msg)) {
      throw new Error(
        "Network error — the browser could not reach this app’s Bible API. " +
          "If you are developing: run `npm run dev`, open the same host and port " +
          "shown in the terminal (e.g. http://localhost:3000), and check VPN/firewall " +
          "is not blocking localhost.",
      );
    }
    throw e;
  }

  const text = await res.text();
  let data: ChapterApiResponse;
  try {
    data = JSON.parse(text) as ChapterApiResponse;
  } catch {
    throw new Error(
      !res.ok
        ? `Server returned ${res.status} with a non-JSON response.`
        : "Invalid JSON from /api/bible/chapter.",
    );
  }

  // 4xx/5xx with our usual `{ error: "..." }` body — still valid payload.
  if (!res.ok && !data.error) {
    throw new Error(`Bible chapter request failed (HTTP ${res.status}).`);
  }

  return data;
}
