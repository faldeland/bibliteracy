import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/requireUser";
import { GridShell } from "./GridShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-paper)] p-6 text-center">
        <h1 className="font-serif text-2xl text-[var(--color-ink)]">
          Bibliteracy
        </h1>
        <p className="max-w-md text-sm text-[var(--color-ink-2)]">
          The grid requires Supabase to be configured so your dots can sync
          across devices and stay private to your account. Add{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="font-mono">.env.local</code> and reload.
        </p>
        <Link
          href="/login"
          className="rounded-lg border border-[var(--color-rule)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-black/5"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const user = await requireUser("/");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="h-full min-h-0 w-full">
      <GridShell
        userId={user.id}
        displayName={profile?.display_name ?? null}
        userEmail={user.email ?? null}
      />
    </main>
  );
}
