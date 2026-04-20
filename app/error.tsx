"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[bibliteracy] unhandled app error:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-paper)] p-8 text-center">
      <h1 className="font-serif text-2xl text-[var(--color-ink)]">
        Something went wrong.
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--color-ink-2)]">
        The grid hit an unexpected error. Reload the page, or try again — your
        local notes are preserved in the browser.
      </p>
      {error?.digest && (
        <p className="mt-1 font-mono text-[10px] text-[var(--color-ink-2)]/70">
          digest: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md border border-[var(--color-rule)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-black/5"
      >
        Try again
      </button>
    </main>
  );
}
