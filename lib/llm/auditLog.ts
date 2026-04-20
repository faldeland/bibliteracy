/**
 * Audit-log writer for LLM-backed generations.
 *
 * Every word-study / deep-dive generation calls `appendAuditLog` at the
 * end of its lifecycle with the final state — model served, sources
 * accepted, audit verdict, latency, etc. — and the row persists in
 * Supabase's `public.llm_audit_log` table. See the migration
 * `supabase/migrations/20260419000000_llm_audit_log.sql` for schema.
 *
 * Design rules:
 *   • Fire-and-forget from the caller's perspective: logging MUST NOT
 *     block the user-facing response. We await the insert here, but the
 *     caller `void`s the promise so an audit outage can't slow down the
 *     happy path.
 *   • Graceful no-op when Supabase isn't configured. Local dev should
 *     work end-to-end without any service role key set.
 *   • No user PII beyond an optional `user_id` supplied by the caller.
 *     Prompts and raw model output are NOT persisted (would be noisy
 *     and risks leaking user-input-derived text into the audit store).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Source } from "./truthRules";

export type AuditVerdict = "pass" | "fail" | "skipped";

export interface AuditLogEntry {
  useCase: string;
  /** Domain key (e.g. Strong's number); null for use cases without one. */
  subjectKey?: string | null;
  model: string;
  temperature: number;
  latencyMs: number;
  sources: Source[];
  /** How many raw citations got stripped by the trusted-source allowlist. */
  strippedSources: number;
  auditVerdict: AuditVerdict;
  /** One-sentence reason from the auditor on FAIL; null otherwise. */
  auditReason?: string | null;
  /** Global refusal reason (§4 or inferred); null when the response went through. */
  refusalReason?: string | null;
  /** Optional scholarly uncertainty caveat (§7). */
  uncertainty?: string | null;
  /** Signed-in user id when available; null for anonymous requests. */
  userId?: string | null;
}

// ─── Client ──────────────────────────────────────────────────────────────────

let client: SupabaseClient | null | undefined;

/**
 * Return a service-role Supabase client, or null when the service role
 * key isn't configured. We memoize per-process — the underlying client
 * keeps its own keep-alive pool.
 *
 * We intentionally don't reuse `lib/supabase/server.ts` because that
 * module wires a cookie-based SSR client keyed to the request, which
 * is wrong for a fire-and-forget server-side audit write.
 */
function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    client = null;
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // This is a server-side writer; the server is the only actor and
    // we never want this client to carry a user session.
    global: { headers: { "x-application-name": "bibliteracy-audit" } },
  });
  return client;
}

export function auditLogConfigured(): boolean {
  return getClient() !== null;
}

// ─── Writer ──────────────────────────────────────────────────────────────────

/**
 * Append a single audit row. Returns true on success, false on
 * configured-but-failed (so callers can log without crashing). Always
 * resolves — never throws — so a fire-and-forget `void` at the call
 * site is safe.
 */
export async function appendAuditLog(entry: AuditLogEntry): Promise<boolean> {
  const sb = getClient();
  if (!sb) return false;

  const row = {
    use_case: entry.useCase,
    subject_key: entry.subjectKey ?? null,
    model: entry.model,
    // Supabase numeric(3,2) accepts JS numbers; cap defensively.
    temperature: clampTemp(entry.temperature),
    latency_ms: Math.max(0, Math.round(entry.latencyMs)),
    sources: entry.sources,
    stripped_sources: Math.max(0, Math.round(entry.strippedSources)),
    audit_verdict: entry.auditVerdict,
    audit_reason: entry.auditReason ?? null,
    refusal_reason: entry.refusalReason ?? null,
    uncertainty: entry.uncertainty ?? null,
    user_id: entry.userId ?? null,
  };

  try {
    const { error } = await sb.from("llm_audit_log").insert(row);
    if (error) {
      console.warn("[auditLog] insert failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[auditLog] insert threw:", err);
    return false;
  }
}

function clampTemp(t: number): number {
  if (!Number.isFinite(t)) return 0;
  if (t < 0) return 0;
  if (t > 2) return 2;
  return Math.round(t * 100) / 100;
}
