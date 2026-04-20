import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <Centered>
        <h1 className="font-serif text-2xl">Invite</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-2)]">
          The backend isn&apos;t configured, so invites can&apos;t be accepted right
          now.
        </p>
      </Centered>
    );
  }

  const supabase = await createClient();

  const { data: invite } = await supabase
    .from("invites")
    .select("id, owner_id, email, accepted_by, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <Centered>
        <h1 className="font-serif text-2xl">Invite not found</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-2)]">
          This link is invalid or has been revoked.
        </p>
      </Centered>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/invite/${token}`);
  }

  // Already accepted? Show success.
  if (invite.accepted_by === user.id) {
    return <AcceptedView ownerId={invite.owner_id} />;
  }

  if (invite.accepted_by && invite.accepted_by !== user.id) {
    return (
      <Centered>
        <h1 className="font-serif text-2xl">Invite already used</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-2)]">
          This invite was claimed by another account.
        </p>
      </Centered>
    );
  }

  // Owner of this invite — show a friendly hint.
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", invite.owner_id)
    .maybeSingle();

  return (
    <Centered>
      <h1 className="font-serif text-2xl">You&apos;re invited</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-2)]">
        {ownerProfile?.display_name ?? "Someone"} has invited you to view their
        guests-only Logos, Prayer, and Discipleship dots, and to join their
        always-on lounge.
      </p>
      <form action={`/api/invites/${token}/accept`} method="post" className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-semibold text-[var(--color-paper)] hover:opacity-90"
        >
          Accept invite
        </button>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-paper)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-rule)] bg-white p-6 shadow-sm">
        {children}
        <div className="mt-6">
          <Link href="/" className="text-sm text-[var(--color-ink-2)] underline">
            Back to grid
          </Link>
        </div>
      </div>
    </main>
  );
}

function AcceptedView({ ownerId: _ownerId }: { ownerId: string }) {
  return (
    <Centered>
      <h1 className="font-serif text-2xl">Welcome</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-2)]">
        You&apos;re connected. You can now see this person&apos;s guest-visible
        dots and join their lounge.
      </p>
    </Centered>
  );
}
