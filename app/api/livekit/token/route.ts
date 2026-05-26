import { NextResponse, type NextRequest } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { ensureLoungeRoom } from "@/lib/lounge/ensureLoungeRoom";
import {
  isLiveKitPlaceholderConfig,
  LIVEKIT_SETUP_HINT,
  livekitApiKey,
  livekitApiSecret,
  livekitWsUrl,
} from "@/lib/lounge/livekitEnv";
import { loungeRoomNameForUser } from "@/lib/lounge/loungeRoomName";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface TokenRequest {
  /** "lounge" or a specific dot id. */
  roomName?: string;
  /** Display name shown to other participants. */
  name?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as TokenRequest;
  const { roomName, name } = body;

  if (!roomName) {
    return NextResponse.json({ error: "roomName required" }, { status: 400 });
  }

  const apiKey = livekitApiKey();
  const apiSecret = livekitApiSecret();
  const wsUrl = livekitWsUrl();

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit not configured on server" },
      { status: 503 },
    );
  }

  if (isLiveKitPlaceholderConfig()) {
    return NextResponse.json({ error: LIVEKIT_SETUP_HINT }, { status: 503 });
  }

  // Resolve identity from Supabase session if available; otherwise use a
  // throwaway identity so unauthenticated dev sessions still work.
  let identity = "guest_" + Math.random().toString(36).slice(2, 10);
  let displayName = name?.trim() || "Guest";
  const canPublish = true;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      identity = `u_${user.id}`;
      displayName = name?.trim() || user.email || identity;

      // Authorize: owner of the room, or a guest of the room owner.
      const allowed = await isAuthorizedForRoom(
        supabase,
        user.id,
        roomName,
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "Not authorized for this room" },
          { status: 403 },
        );
      }

      if (roomName === loungeRoomNameForUser(user.id)) {
        try {
          await ensureLoungeRoom(supabase, user.id);
        } catch (e) {
          console.warn("[livekit/token] ensure lounge room:", e);
        }
      }
    }
  } catch (e) {
    console.warn("[livekit/token] auth check skipped:", e);
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: displayName,
    ttl: 60 * 60, // 1h
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: wsUrl, identity, room: roomName });
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/**
 * Authorize a user to join a room.
 *  - lounge_<ownerHex>     → owner OR a guest of <ownerHex>
 *  - dot_<dotShortId>      → owner of dot OR a guest of dot owner (and dot
 *                            visibility is 'guests' or 'public')
 */
async function isAuthorizedForRoom(
  supabase: SupabaseLike,
  userId: string,
  roomName: string,
): Promise<boolean> {
  // Look the room up first; rooms is the source of truth.
  const { data: room } = await supabase
    .from("rooms")
    .select("id, owner_id, kind, dot_id")
    .eq("livekit_room_name", roomName)
    .maybeSingle();

  if (!room) {
    return roomName === loungeRoomNameForUser(userId);
  }
  if (room.owner_id === userId) return true;

  if (room.kind === "lounge") {
    const { data: g } = await supabase
      .from("guests")
      .select("guest_id")
      .eq("owner_id", room.owner_id)
      .eq("guest_id", userId)
      .maybeSingle();
    return !!g;
  }

  if (room.kind === "dot" && room.dot_id) {
    const { data: dot } = await supabase
      .from("dots")
      .select("owner_id, visibility")
      .eq("id", room.dot_id)
      .maybeSingle();
    if (!dot) return false;
    if (dot.visibility === "public") return true;
    if (dot.visibility !== "guests") return false;
    const { data: g } = await supabase
      .from("guests")
      .select("guest_id")
      .eq("owner_id", dot.owner_id)
      .eq("guest_id", userId)
      .maybeSingle();
    return !!g;
  }

  return false;
}
