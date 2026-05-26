import { loungeRoomNameForUser } from "@/lib/lounge/loungeRoomName";
import type { createClient } from "@/lib/supabase/server";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/**
 * Return the user's lounge LiveKit room name, inserting the `rooms` row when
 * missing (e.g. accounts created before the signup trigger).
 */
export async function ensureLoungeRoom(
  supabase: SupabaseLike,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("rooms")
    .select("livekit_room_name")
    .eq("owner_id", userId)
    .eq("kind", "lounge")
    .maybeSingle();

  if (existing?.livekit_room_name) {
    return existing.livekit_room_name;
  }

  const livekit_room_name = loungeRoomNameForUser(userId);
  const { error } = await supabase.from("rooms").insert({
    owner_id: userId,
    kind: "lounge",
    livekit_room_name,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  return livekit_room_name;
}
