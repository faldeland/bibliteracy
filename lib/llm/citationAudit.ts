/**
 * Post-generation citation-claim auditor.
 *
 * After a feature generates a draft response, we run this adversarial
 * auditor to check whether the draft is consistent with the retrieved
 * authoritative lexicon entry. If the audit fails, the caller promotes
 * the response to a refusal and the UI hides the affected section.
 *
 * Why run an auditor at all when the main model already has the
 * retrieved entry? Two reasons:
 *
 *   1. The generator has instructions to ground in the retrieved entry,
 *      but it's still the same agent doing both the writing and the
 *      self-check. An independent pass with a narrower prompt catches
 *      cases where the generator drifted into plausible-sounding
 *      parametric recall that contradicts the entry.
 *   2. Auditor models are cheap — we run `gpt-4o-mini` by default — and
 *      latency is absorbed by the existing in-memory cache.
 *
 * The audit is intentionally conservative: PASS is the default verdict
 * unless the draft explicitly contradicts the retrieved entry. Silence
 * in the entry is not a contradiction; legitimate grounding in another
 * trusted lexicon (cited via `sources`) is allowed.
 */

import { chatJson, type ChatMessage } from "./pipellm";
import type { RetrievedEntry } from "./retrievalContext";
import type { Source } from "./truthRules";

export interface AuditOptions {
  retrieved: RetrievedEntry;
  draftText: string;
  sources: Source[];
  logTag: string;
  logKey?: string;
}

export type AuditResult =
  | { ok: true }
  | { ok: false; reason: string };

interface AuditJson {
  verdict: string;
  reason?: string;
}

function validate(raw: unknown): AuditJson | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AuditJson>;
  if (typeof r.verdict !== "string") return null;
  return r as AuditJson;
}

function buildMessages(opts: AuditOptions): ChatMessage[] {
  const srcList = opts.sources.length
    ? opts.sources
        .map((s) => `- ${s.citation}${s.locus ? ` (${s.locus})` : ""}`)
        .join("\n")
    : "(none)";

  const system = [
    "You are an adversarial fact-check auditor for biblical",
    "lexicography. Your job is to decide whether a drafted word-study",
    "response is consistent with an authoritative lexicon entry.",
    "",
    "Default to PASS. Only FAIL when the draft contains a specific",
    "factual claim that the retrieved lexicon entry explicitly",
    "contradicts or rules out. Silence in the retrieved entry is NOT a",
    "contradiction — the drafter may legitimately be drawing on one of",
    "the other trusted works they cited. Stylistic, emphasis, or",
    "tone differences are not failures. A claim broader than the",
    "retrieved entry is fine as long as it isn't at odds with it.",
    "",
    "Respond with a single JSON object, no markdown fences, no prose:",
    "",
    "type Out = {",
    '  verdict: "pass" | "fail";',
    "  reason: string; // one sentence; cite the contradicting line from the entry when failing",
    "};",
    "",
    "Note: the global citation-envelope rules in the first system",
    "message still apply, but this audit step is evaluative and does",
    "not need to emit a `sources` array. Leave sources out.",
  ].join("\n");

  const user = [
    `[RETRIEVED LEXICON ENTRY — ${opts.retrieved.source}]`,
    opts.retrieved.text,
    `[END RETRIEVED ENTRY]`,
    "",
    `[DRAFT CLAIM TO AUDIT]`,
    opts.draftText,
    `[END DRAFT]`,
    "",
    `[WORKS THE DRAFTER CITED]`,
    srcList,
    `[END WORKS]`,
    "",
    "Does the draft contradict the retrieved lexicon entry? Respond",
    "with the JSON schema above. Err on the side of PASS.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/**
 * Run the audit. Returns `{ ok: true }` when the draft is consistent
 * (or when the audit LLM is unavailable — we don't block a response on
 * an auditor outage), and `{ ok: false, reason }` on confirmed
 * contradiction.
 */
export async function auditDraft(opts: AuditOptions): Promise<AuditResult> {
  // If we never had real retrieved content, there is nothing to audit
  // against. The draft has to stand on its citations alone.
  if (!opts.retrieved.hasContent) return { ok: true };

  const result = await chatJson<AuditJson>({
    useCase: "citationAudit",
    messages: buildMessages(opts),
    // Auditor must be deterministic — same input, same verdict.
    temperature: 0,
    validate,
    logTag: `${opts.logTag}:audit`,
    logKey: opts.logKey,
  });

  // Soft-fail: if the auditor itself failed (network, schema), don't
  // block the response. The generator's own grounding + the
  // trusted-source allowlist are the primary safety net; the audit is
  // an additional guard.
  if (!result) return { ok: true };

  const verdict = result.data.verdict.trim().toLowerCase();
  const tag = `[${opts.logTag}:audit]`;
  const id = opts.logKey ? `${tag} ${opts.logKey}` : tag;
  if (verdict === "fail") {
    const reason = result.data.reason?.trim() || "Auditor flagged an unverified claim.";
    console.info(id, "FAIL —", reason);
    return { ok: false, reason };
  }
  console.info(id, "PASS");
  return { ok: true };
}
