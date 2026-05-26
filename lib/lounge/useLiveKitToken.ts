"use client";

import { useEffect, useState } from "react";

export function useLiveKitToken(roomName: string, displayName?: string) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setToken(null);
      setServerUrl(null);
      setError(null);
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomName, name: displayName }),
      });
      if (cancelled) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as { token: string; url: string };
      setToken(json.token);
      setServerUrl(json.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomName, displayName]);

  return {
    token,
    serverUrl,
    error,
    ready: !!token && !!serverUrl,
    loading: !error && (!token || !serverUrl),
  };
}
