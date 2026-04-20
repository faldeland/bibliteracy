-- ─────────────────────────────────────────────────────────────────────────────
-- LLM audit log
--
-- Every LLM-backed generation in the app (word-usage notes, deep-dive
-- studies, and eventually anything else routed through lib/llm/pipellm.ts)
-- appends one row here with the inputs, the model's output, the cited
-- sources, the post-generation audit verdict, and any refusal reason.
--
-- Purpose:
--   • Regression analysis — spot when a model update starts producing
--     lower-quality citations or more audit failures.
--   • Forensics — when a user reports a bad answer, we can find the
--     exact row, see every source claimed, and see what the auditor said.
--   • Cost accounting — roll up by model + latency + date.
--
-- Policy:
--   • Service-role writes only (the server calls this via the service key).
--   • Authenticated users can read their own rows if user_id matches.
--     Anonymous generations (no signed-in user) are visible to service
--     role only. We may later open up read-only aggregates to dashboards.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.llm_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Which app feature ran the generation. Mirrors the UseCase enum in
  -- lib/llm/pipellm.ts: 'wordUsage' | 'wordDeepDive' | 'citationAudit' | …
  use_case text not null,

  -- Domain key. For word studies this is the Strong's number (H#### / G####).
  -- Null for use cases that aren't keyed by a domain entity.
  subject_key text,

  -- The model slug PipeLLM served, e.g. 'gpt-4o', 'gpt-4o-mini'.
  model text not null,

  -- Sampling temperature actually used for this generation (0 for factual).
  temperature numeric(3,2),

  -- End-to-end wall time for the generation + audit, in milliseconds.
  latency_ms integer,

  -- The normalized + trusted-source-allowlisted sources array, exactly as
  -- returned to the UI. Each item: { citation, type, locus, url }.
  sources jsonb not null default '[]'::jsonb,

  -- How many raw citations the model tried to emit that got stripped by
  -- the trusted-source allowlist or URL sanitizer before this log row.
  stripped_sources integer not null default 0,

  -- 'pass' | 'fail' | 'skipped' (skipped when no retrieved entry existed).
  audit_verdict text not null check (audit_verdict in ('pass','fail','skipped')),

  -- One-sentence reason from the auditor on a FAIL verdict; null otherwise.
  audit_reason text,

  -- Populated when the generator took the refusal path (global §4, inferred
  -- from missing sources, or promoted from an audit FAIL). UI hid the content.
  refusal_reason text,

  -- Optional one-sentence scholarly uncertainty caveat (§7).
  uncertainty text,

  -- Signed-in user, when available. Service-role writes pass null.
  user_id uuid references auth.users(id) on delete set null
);

create index if not exists llm_audit_log_created_at_idx
  on public.llm_audit_log(created_at desc);
create index if not exists llm_audit_log_use_case_idx
  on public.llm_audit_log(use_case, created_at desc);
create index if not exists llm_audit_log_subject_idx
  on public.llm_audit_log(subject_key, created_at desc);
create index if not exists llm_audit_log_verdict_idx
  on public.llm_audit_log(audit_verdict, created_at desc)
  where audit_verdict = 'fail';

alter table public.llm_audit_log enable row level security;

-- Authenticated users may read their own rows (useful for a "my history"
-- surface later). Service role bypasses RLS entirely for writes + reads.
drop policy if exists llm_audit_log_select_own on public.llm_audit_log;
create policy llm_audit_log_select_own on public.llm_audit_log
  for select using (auth.uid() is not null and auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies — service role is the only writer.
