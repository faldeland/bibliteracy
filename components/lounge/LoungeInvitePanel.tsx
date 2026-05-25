"use client";

import { useState } from "react";

export function LoungeInvitePanel({ onClose }: { onClose?: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInviteLink(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    const { invite } = (await res.json()) as {
      invite: { token: string; email: string };
    };
    const link = `${window.location.origin}/invite/${invite.token}`;
    setInviteLink(link);
    setEmail(invite.email);
  }

  function copyLink() {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function mailtoInvite() {
    if (!inviteLink || !email) return;
    const subject = encodeURIComponent("Join me on Bibliteracy");
    const body = encodeURIComponent(
      `You're invited to view my guest-visible dots and join my lounge for live study.\n\nAccept your invite:\n${inviteLink}`,
    );
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-white/15 bg-[#1a1a1f] p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Invite by email
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close invite panel"
          >
            ×
          </button>
        )}
      </div>
      <p className="mb-2 text-[11px] leading-snug text-white/55">
        Creates a one-time link. Send it from your mail app or copy it to share.
        Guests can join this lounge after they accept.
      </p>
      <form onSubmit={onSubmit} className="flex gap-1.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="friend@example.com"
          className="min-w-0 flex-1 rounded border border-white/20 bg-black/30 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/40"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25 disabled:opacity-50"
        >
          {busy ? "…" : "Invite"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-[11px] text-red-300">{error}</p>}
      {inviteLink && (
        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
          <p className="truncate font-mono text-[10px] text-white/70">{inviteLink}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 rounded border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 hover:bg-white/10"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={mailtoInvite}
              className="flex-1 rounded bg-emerald-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-emerald-700/80"
            >
              Email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
