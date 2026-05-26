import { afterEach, describe, expect, it } from "vitest";
import {
  isLiveKitPlaceholderConfig,
  isLiveKitServerConfigured,
  livekitWsUrl,
} from "@/lib/lounge/livekitEnv";

describe("livekitEnv", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("prefers NEXT_PUBLIC_LIVEKIT_URL over LIVEKIT_URL", () => {
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://public.example";
    process.env.LIVEKIT_URL = "wss://private.example";
    expect(livekitWsUrl()).toBe("wss://public.example");
  });

  it("falls back to LIVEKIT_URL", () => {
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;
    process.env.LIVEKIT_URL = "wss://private.example";
    expect(livekitWsUrl()).toBe("wss://private.example");
  });

  it("isLiveKitServerConfigured requires key, secret, and url", () => {
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    process.env.LIVEKIT_URL = "wss://x.example";
    delete process.env.NEXT_PUBLIC_LIVEKIT_URL;
    expect(isLiveKitServerConfigured()).toBe(true);
  });

  it("detects placeholder config", () => {
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://your-project.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "PASTE_LIVEKIT_API_KEY_HERE";
    process.env.LIVEKIT_API_SECRET = "PASTE_LIVEKIT_API_SECRET_HERE";
    expect(isLiveKitPlaceholderConfig()).toBe(true);
  });
});
