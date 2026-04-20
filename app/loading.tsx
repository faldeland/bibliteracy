export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-paper)]">
      <div
        role="status"
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)]"
      />
      <p className="mt-3 text-xs uppercase tracking-widest text-[var(--color-ink-2)]">
        Loading the grid…
      </p>
    </main>
  );
}
