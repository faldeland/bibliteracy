"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { setAuthNextCookie } from "@/lib/auth/postLoginNext";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error" | "unconfigured"
  >(isSupabaseConfigured() ? "idle" : "unconfigured");
  const [googleStatus, setGoogleStatus] = useState<"idle" | "redirecting">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Supabase allow-list matches redirect URLs exactly — no `?next=` query string. */
  function buildCallbackUrl(): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/auth/callback`;
  }

  function rememberReturnPath(): void {
    setAuthNextCookie(nextParam);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setStatus("unconfigured");
      return;
    }
    setStatus("sending");
    setErrorMsg(null);
    rememberReturnPath();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: buildCallbackUrl() },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  async function onGoogle() {
    if (!isSupabaseConfigured()) {
      setStatus("unconfigured");
      return;
    }
    setGoogleStatus("redirecting");
    setErrorMsg(null);
    rememberReturnPath();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: buildCallbackUrl() },
    });
    if (error) {
      setErrorMsg(error.message);
      setGoogleStatus("idle");
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-rule)] bg-white p-6 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold text-[var(--color-ink)]">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">
          Continue with Google or get a magic link by email.
        </p>

        {status === "unconfigured" ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Supabase isn&apos;t configured yet. Add{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono">.env.local</code> to enable accounts,
            then reload.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onGoogle}
              disabled={googleStatus === "redirecting"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-rule)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)] disabled:opacity-60"
            >
              <GoogleLogo className="h-4 w-4" />
              {googleStatus === "redirecting"
                ? "Redirecting…"
                : "Continue with Google"}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--color-ink-2)]">
              <span className="h-px flex-1 bg-[var(--color-rule)]" />
              or
              <span className="h-px flex-1 bg-[var(--color-rule)]" />
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="email"
                required
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
          </>
        )}

        {nextParam && nextParam !== "/" && (
          <p className="mt-4 text-xs text-[var(--color-ink-2)]">
            After sign-in you&apos;ll return to{" "}
            <code className="font-mono">{nextParam}</code>.
          </p>
        )}

        <p className="mt-4 text-xs text-[var(--color-ink-2)]">
          <Link href="/" className="underline">
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.3C40.9 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
