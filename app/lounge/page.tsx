import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoungeRoom } from "./LoungeRoom";

export const dynamic = "force-dynamic";

export default async function LoungePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-[var(--color-paper)] p-6 text-center">
        <h1 className="font-serif text-2xl text-[var(--color-ink)]">Lounge</h1>
        <p className="max-w-md text-sm text-[var(--color-ink-2)]">
          The always-on lounge requires Supabase + LiveKit to be configured.
          Add the env vars from <code>.env.example</code> and restart.
        </p>
        <Link
          href="/"
          className="rounded-lg border border-[var(--color-rule)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-black/5"
        >
          Back to grid
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve the user's lounge room (created by the on_auth_user_created trigger).
  const { data: lounge } = await supabase
    .from("rooms")
    .select("livekit_room_name")
    .eq("owner_id", user.id)
    .eq("kind", "lounge")
    .maybeSingle();

  const roomName =
    lounge?.livekit_room_name ?? `lounge_${user.id.replace(/-/g, "")}`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="flex h-dvh flex-col bg-[var(--color-ink)] text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md px-2 py-1 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            ← Grid
          </Link>
          <h1 className="font-serif text-lg">Lounge</h1>
          <span className="hidden text-xs text-white/50 sm:inline">
            {roomName}
          </span>
        </div>
        <div className="text-xs text-white/60">
          {profile?.display_name ?? user.email}
        </div>
      </header>
      <div className="flex-1">
        <LoungeRoom
          roomName={roomName}
          displayName={profile?.display_name ?? user.email ?? "Friend"}
        />
      </div>
    </main>
  );
}
