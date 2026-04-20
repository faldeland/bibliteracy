import Link from "next/link";

export const metadata = {
  title: "Not found · Bibliteracy",
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-paper)] p-8 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-2)]">
        404
      </p>
      <h1 className="mt-2 font-serif text-2xl text-[var(--color-ink)]">
        That page isn&apos;t in the canon.
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--color-ink-2)]">
        We couldn&apos;t find what you were looking for. Head back to the grid
        and pick up where you left off.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-[var(--color-rule)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-black/5"
      >
        Back to the grid
      </Link>
    </main>
  );
}
