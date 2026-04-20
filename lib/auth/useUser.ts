"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface UseUserResult {
  user: User | null;
  /** True until the first `auth.getUser()` round-trip resolves. */
  isLoading: boolean;
  isConfigured: boolean;
}

/**
 * Client hook that tracks the currently signed-in Supabase user. Emits
 * updates on `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`. Safe to call when
 * Supabase isn't configured — it simply reports `user: null`.
 */
export function useUser(initialUser: User | null = null): UseUserResult {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      return;
    }
    const supabase = supabaseRef.current ?? createClient();
    supabaseRef.current = supabase;
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  return { user, isLoading, isConfigured: configured };
}
