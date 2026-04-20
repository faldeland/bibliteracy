"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

/**
 * App-wide client provider. Owns the TanStack Query cache and a Supabase
 * auth listener that clears the cache whenever the signed-in user changes,
 * so a sign-out / account switch never leaks another user's data.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();

    const handle = (userId: string | null) => {
      if (lastUserId.current !== undefined && lastUserId.current !== userId) {
        queryClient.clear();
      }
      lastUserId.current = userId;
    };

    supabase.auth.getUser().then(({ data }) => {
      handle(data.user?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        lastUserId.current = null;
        return;
      }
      handle(session?.user?.id ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
