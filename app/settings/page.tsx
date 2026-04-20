import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { InvitesPanel } from "./InvitesPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-2)]">
          Backend isn&apos;t configured. The grid is running in local-only mode,
          so there&apos;s nothing to configure here yet.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Back to grid
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, token, accepted_at, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const { data: guests } = await supabase
    .from("guests")
    .select("guest_id, created_at, profiles:guest_id(display_name)")
    .eq("owner_id", user.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Settings</h1>
          <p className="text-sm text-[var(--color-ink-2)]">
            {profile?.display_name ?? user.email}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-[var(--color-rule)] bg-white px-3 py-1.5 text-sm hover:bg-black/5"
        >
          ← Grid
        </Link>
      </header>

      <section className="mb-8 rounded-2xl border border-[var(--color-rule)] bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg">Guests</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">
          People who have accepted an invite from you. They can see your dots
          marked <em>guests-only</em> and join your lounge.
        </p>
        {guests && guests.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--color-rule)]">
            {guests.map((g) => {
              const name =
                Array.isArray(g.profiles)
                  ? (g.profiles[0] as { display_name?: string } | undefined)?.display_name
                  : (g.profiles as { display_name?: string } | null)?.display_name;
              return (
                <li
                  key={g.guest_id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>{name ?? g.guest_id}</span>
                  <span className="text-xs text-[var(--color-ink-2)]">
                    since {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm italic text-[var(--color-ink-2)]">
            No guests yet.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-rule)] bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg">Invites</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">
          Generate a one-time link and share it with the person you want to
          invite.
        </p>
        <InvitesPanel
          initialInvites={(invites ?? []).map((i) => ({
            id: i.id,
            email: i.email,
            token: i.token,
            acceptedAt: i.accepted_at,
            createdAt: i.created_at,
          }))}
        />
      </section>
    </main>
  );
}
