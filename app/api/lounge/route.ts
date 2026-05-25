import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export interface HostLounge {
  ownerId: string;
  ownerName: string;
  roomName: string;
}

/**
 * Lounge session metadata for the signed-in user: their always-on room plus
 * any host lounges they may join as an accepted guest.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: ownLounge } = await supabase
    .from("rooms")
    .select("livekit_room_name")
    .eq("owner_id", user.id)
    .eq("kind", "lounge")
    .maybeSingle();

  const roomName =
    ownLounge?.livekit_room_name ?? `lounge_${user.id.replace(/-/g, "")}`;

  const displayName = profile?.display_name ?? user.email ?? "Friend";

  const { data: guestRows } = await supabase
    .from("guests")
    .select("owner_id")
    .eq("guest_id", user.id);

  const ownerIds = (guestRows ?? []).map((g) => g.owner_id);
  const hostLounges: HostLounge[] = [];

  if (ownerIds.length > 0) {
    const { data: hostRooms } = await supabase
      .from("rooms")
      .select("owner_id, livekit_room_name")
      .in("owner_id", ownerIds)
      .eq("kind", "lounge");

    const { data: hostProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", ownerIds);

    const nameByOwner = new Map(
      (hostProfiles ?? []).map((p) => [p.user_id, p.display_name]),
    );

    for (const r of hostRooms ?? []) {
      hostLounges.push({
        ownerId: r.owner_id,
        ownerName: nameByOwner.get(r.owner_id) ?? "Host",
        roomName: r.livekit_room_name,
      });
    }
  }

  const livekitConfigured =
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET &&
    !!process.env.NEXT_PUBLIC_LIVEKIT_URL;

  return NextResponse.json({
    roomName,
    displayName,
    livekitConfigured,
    hostLounges,
  });
}
