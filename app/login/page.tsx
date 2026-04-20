"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error" | "unconfigured"
  >(isSupabaseConfigured() ? "idle" : "unconfigured");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setStatus("unconfigured");
      return;
    }
    setStatus("sending");
    setErrorMsg(null);
    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-rule)] bg-white p-6 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold text-[var(--color-ink)]">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">
          We&apos;ll email you a magic link.
        </p>

        {status === "unconfigured" ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Supabase isn&apos;t configured yet. The app runs in offline (local) mode —
            head back to the{" "}
            <Link className="underline" href="/">
              grid
            </Link>{" "}
            to start journaling. Add{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono">.env.local</code> to enable accounts and
            sync.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-paper)] hover:opacity-90 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "sent" && (
              <p className="text-sm text-emerald-700">
                Check your inbox for a link to sign in.
              </p>
            )}
            {status === "error" && errorMsg && (
              <p className="text-sm text-red-700">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
