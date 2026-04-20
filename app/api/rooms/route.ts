import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RoomRequest {
  dotId: string;
}

/**
 * Ensure a LiveKit room exists for a Discipleship dot. Idempotent: if a row
 * already exists for the dot, returns its livekit_room_name.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RoomRequest;
  const dotId = body.dotId;
  if (!dotId) {
    return NextResponse.json({ error: "dotId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Confirm the caller owns the dot.
  const { data: dot } = await supabase
    .from("dots")
    .select("id, owner_id, kind")
    .eq("id", dotId)
    .maybeSingle();

  if (!dot || dot.owner_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (dot.kind !== "discipleship") {
    return NextResponse.json(
      { error: "rooms only for discipleship dots" },
      { status: 400 },
    );
  }

  // Look for an existing room for this dot.
  const { data: existing } = await supabase
    .from("rooms")
    .select("livekit_room_name")
    .eq("dot_id", dotId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ roomName: existing.livekit_room_name });
  }

  const roomName = `dot_${dotId.replace(/-/g, "")}`;
  const { error: insertErr } = await supabase.from("rooms").insert({
    owner_id: user.id,
    kind: "dot",
    dot_id: dotId,
    livekit_room_name: roomName,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Mirror onto the dot for convenience.
  await supabase
    .from("dots")
    .update({ livekit_room_name: roomName })
    .eq("id", dotId);

  return NextResponse.json({ roomName });
}
