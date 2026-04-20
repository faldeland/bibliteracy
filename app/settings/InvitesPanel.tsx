"use client";

import { useState } from "react";

interface InviteRow {
  id: string;
  email: string;
  token: string;
  acceptedAt: string | null;
  createdAt: string;
}

export function InvitesPanel({
  initialInvites,
}: {
  initialInvites: InviteRow[];
}) {
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    const { invite } = (await res.json()) as { invite: InviteRow };
    setInvites([
      {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        acceptedAt: null,
        createdAt: invite.createdAt ?? new Date().toISOString(),
      },
      ...invites,
    ]);
    setEmail("");
  }

  return (
    <>
      <form onSubmit={onCreate} className="mt-4 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          className="flex-1 rounded-lg border border-[var(--color-rule)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink-2)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-paper)] hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create invite"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {invites.length > 0 && (
        <ul className="mt-5 divide-y divide-[var(--color-rule)]">
          {invites.map((i) => (
            <InviteItem key={i.id} invite={i} />
          ))}
        </ul>
      )}
    </>
  );
}

function InviteItem({ invite }: { invite: InviteRow }) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${invite.token}`
      : `/invite/${invite.token}`;

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <li className="flex items-center justify-between py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{invite.email}</div>
        <div className="truncate font-mono text-xs text-[var(--color-ink-2)]">
          {link}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {invite.acceptedAt ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-900">
            Accepted
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-900">
            Pending
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-[var(--color-rule)] bg-white px-2 py-1 text-xs hover:bg-black/5"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </li>
  );
}
