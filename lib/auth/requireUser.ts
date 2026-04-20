import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Server-only helper: resolves the current Supabase user or redirects to
 * `/login?next=<nextPath>`. When Supabase isn't configured, the caller is
 * responsible for handling the offline case before invoking this helper.
 */
export async function requireUser(nextPath: string): Promise<User> {
  if (!isSupabaseConfigured()) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

/**
 * Like {@link requireUser} but returns `null` instead of redirecting. Useful
 * for layouts / chrome that want to render a sign-in button when anon.
 */
export async function getOptionalUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
