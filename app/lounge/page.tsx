import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Opens the grid with the global lounge stream bar enabled. */
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
  if (!user) redirect("/login?next=/lounge");

  redirect("/?lounge=1");
}
