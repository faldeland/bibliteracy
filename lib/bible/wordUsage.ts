/**
 * Server-side generator for the "In its time" section of the word-study
 * popover. Given a Strong's number (H#### / G####) and a little lexical
 * context, we ask an LLM for a short, scholarly note on how the word was
 * actually used in its own historical period — Biblical Hebrew / ANE for
 * the OT, Koine Greek / 1st century Greco-Roman world for the NT —
 * including meaningful extra-biblical connotations when they exist.
 *
 * Transport and model selection live in `lib/llm/pipellm.ts`; this module
 * only owns the prompt, the expected JSON schema, and the per-Strong's
 * in-memory cache. The model is configured via `PIPELLM_MODEL_WORD_USAGE`
 * (or the global `PIPELLM_MODEL_DEFAULT`, or the legacy
 * `PIPELLM_USAGE_MODEL`).
 */

import type { WordStudy } from "./bollsApi";
import {
  chatJson,
  pipeLlmConfigured,
  type ChatMessage,
} from "@/lib/llm/pipellm";
import { auditDraft } from "@/lib/llm/citationAudit";
import { appendAuditLog, type AuditVerdict } from "@/lib/llm/auditLog";
import {
  buildRetrievedEntry,
  formatRetrievedBlock,
  type RetrievedEntry,
} from "@/lib/llm/retrievalContext";
import type { Source } from "@/lib/llm/truthRules";

export interface WordUsage {
  strong: string;
  /** e.g. "Koine Greek, 1st century AD" or "Biblical Hebrew, ~1000–500 BC". */
  period: string;
  /** 2–4 sentence plain-English note on how the word was used in that period. */
  commonUsage: string;
  /** Short list of notable extra-biblical connotations, if any. */
  connotations: string[];
  /**
   * Cross-reference works the model attested it drew on, normalized by
   * the shared truth-rules layer. Deep-link URLs are allowlisted.
   */
  sources: Source[];
  /**
   * When set, the model refused to answer truthfully for this Strong's;
   * the other fields will be empty. The UI hides the section in that case.
   */
  refusalReason: string | null;
  /**
   * Optional one-sentence caveat from the global §7 uncertainty protocol.
   * Null when the claim is well-attested.
   */
  uncertainty: string | null;
  /** The model slug PipeLLM actually served this generation from. */
  model: string;
}

// ─── Cache ───────────────────────────────────────────────────────────────────
// Process-lifetime memory cache. A single Strong's is generated once then
// served from here for the lifetime of the Node process. Good enough for dev
// and fine for a single-region deployment; swap for Supabase later if we need
// cross-instance persistence.
const cache = new Map<string, WordUsage>();
const inFlight = new Map<string, Promise<WordUsage | null>>();

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildMessages(
  study: WordStudy,
  retrieved: RetrievedEntry,
): ChatMessage[] {
  const lang = study.strong.startsWith("H") ? "Hebrew" : "Greek";
  const corpus =
    lang === "Hebrew"
      ? "Biblical Hebrew and cognate Northwest Semitic material (Ugaritic, Aramaic, Akkadian where relevant)"
      : "Koine Greek of the 1st century AD, including the Septuagint, papyri, and Greco-Roman literary sources";

  const primaryLexicaHint =
    lang === "Hebrew"
      ? "HALOT, BDB, DCH, Holladay, TDOT, TWOT, NIDOTTE, Jastrow (for Aramaic)"
      : "BDAG, LSJ, Louw-Nida, Moulton-Milligan, TDNT, EDNT, NIDNTTE, Thayer (older, use only when current works don't cover the sense)";

  const system = [
    "You are a careful biblical lexicographer. The truthfulness and",
    "citation rules in the first system message are in force; every",
    "response must include a real `sources` array that names works from",
    "the §6 trusted-source inventory, and must follow the refusal",
    "protocol when you cannot attribute a claim.",
    "",
    "For a given Strong's entry you write a short scholarly note on how",
    "the word was actually used in its own day — in addition to how it",
    "is used in Scripture, capture well-attested extra-biblical senses",
    "(contracts, letters, inscriptions, classical authors, etc.) when",
    "they exist.",
    "",
    `For this ${lang} word the primary authorities you should draw on`,
    `are: ${primaryLexicaHint}. Do not cite Strong's Concordance, Vine's,`,
    "study-Bible notes, devotional commentaries, blogs, or Bible-software",
    "platforms — those are all on the §6.4 prohibited list. Cite the",
    "underlying lexicon itself, not the website that hosts it.",
    "",
    "Prefer at least two trusted sources when possible; if you can only",
    "corroborate from one, include just that one. Keep the tone neutral",
    "and informative, not devotional.",
    "",
    "In addition to the globally-required `sources` and optional",
    "`refusal_reason` envelope, respond with this schema — no markdown",
    "fences, no prose outside the JSON:",
    "",
    "type Out = {",
    '  period: string;          // e.g. "Koine Greek, 1st century AD"',
    "  common_usage: string;    // 2–4 sentences, plain English",
    "  connotations?: string[]; // 0–4 short bullets, each <= 12 words",
    "  sources: Source[];       // REQUIRED by the global rules",
    "  refusal_reason?: string; // set per the global refusal protocol",
    "};",
    "",
    "If you cannot cite at least one work from §6.3 for this Strong's",
    "number, use the refusal protocol: set `period`, `common_usage` to",
    "empty strings, `connotations` and `sources` to empty arrays, and",
    "set `refusal_reason`.",
  ].join("\n");

  const user = [
    `Strong's: ${study.strong}`,
    `Lemma: ${study.lexeme}`,
    `Transliteration: ${study.transliteration}`,
    `Standard biblical gloss: ${study.shortGloss}`,
    formatRetrievedBlock(retrieved),
    "",
    `Describe the word as it lived in ${corpus}. Focus on everyday`,
    "semantic range and idiomatic usage in that period; only mention",
    "theological senses if they dominate the evidence. Prefer concrete",
    "examples of usage domains (commerce, cult, household, military,",
    "etc.) over abstract taxonomy.",
    "",
    "Every `citation` field must name a trusted work from §6.3 (e.g.",
    `'BDAG s.v. ${study.lexeme}', 'HALOT 1:137, s.v. ${study.lexeme}',`,
    "'TDNT vol. 4, pp. 102–114'). Include the lemma in a lookup-friendly",
    "form and a page/volume locus when you know one. Use `url` only for",
    "deep links on the allowlisted hosts; otherwise omit.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ─── Schema validation ───────────────────────────────────────────────────────

interface LlmShape {
  period: string;
  common_usage: string;
  connotations?: string[];
}

// We validate only the shape, not the content. Empty strings are valid when
// the model takes the global refusal path — the caller checks `refusalReason`
// separately. Structural failure (wrong types / missing keys) still returns
// null so `chatJson` treats it as a soft failure.
function validate(raw: unknown): LlmShape | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LlmShape>;
  if (typeof r.period !== "string" || typeof r.common_usage !== "string") {
    return null;
  }
  return r as LlmShape;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function generate(study: WordStudy): Promise<WordUsage | null> {
  const retrieved = buildRetrievedEntry(study.strong, study.detailHtml);
  const startedAt = Date.now();

  const result = await chatJson<LlmShape>({
    useCase: "wordUsage",
    messages: buildMessages(study, retrieved),
    validate,
    logTag: "wordUsage",
    logKey: study.strong,
  });
  if (!result) return null;

  const shape = result.data;
  const connotations = Array.isArray(shape.connotations)
    ? shape.connotations
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  // Cross-enforce the truth rules: if the model produced prose without any
  // sources, treat it as a refusal rather than silently serving uncorroborated
  // content. This catches cases where the model ignored the §2 requirement.
  const hasProse =
    shape.period.trim().length > 0 && shape.common_usage.trim().length > 0;
  const inferredRefusal =
    hasProse && result.sources.length === 0
      ? "Model returned prose without any cross-reference sources; suppressed."
      : null;

  // Post-generation audit: if we had a real retrieved entry, ask a
  // second model to check the draft against it. A FAIL verdict means
  // the draft actively contradicts the ground-truth lexicon — we treat
  // that as a refusal rather than serve known-bad content. PASS (or a
  // soft auditor outage) keeps the content live.
  let auditRefusal: string | null = null;
  let auditVerdict: AuditVerdict = "skipped";
  let auditReason: string | null = null;
  if (hasProse && retrieved.hasContent) {
    const draftText = [
      `Period: ${shape.period}`,
      `Common usage: ${shape.common_usage}`,
      connotations.length ? `Connotations: ${connotations.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const audit = await auditDraft({
      retrieved,
      draftText,
      sources: result.sources,
      logTag: "wordUsage",
      logKey: study.strong,
    });
    if (!audit.ok) {
      auditRefusal = `Audit suppressed: ${audit.reason}`;
      auditVerdict = "fail";
      auditReason = audit.reason;
    } else {
      auditVerdict = "pass";
    }
  }

  const refusalReason = result.refusalReason ?? inferredRefusal ?? auditRefusal;

  // Fire-and-forget audit log. We don't await here — the user-facing
  // response must not wait on Supabase. `appendAuditLog` swallows its
  // own errors, so `void` is safe.
  void appendAuditLog({
    useCase: "wordUsage",
    subjectKey: study.strong,
    model: result.model,
    temperature: 0,
    latencyMs: Date.now() - startedAt,
    sources: result.sources,
    strippedSources: result.strippedSources,
    auditVerdict,
    auditReason,
    refusalReason,
    uncertainty: result.uncertainty,
  });

  return {
    strong: study.strong,
    period: shape.period.trim(),
    commonUsage: shape.common_usage.trim(),
    connotations,
    sources: result.sources,
    refusalReason,
    uncertainty: result.uncertainty,
    model: result.model,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchWordUsage(
  study: WordStudy,
): Promise<WordUsage | null> {
  const cached = cache.get(study.strong);
  if (cached) return cached;

  const pending = inFlight.get(study.strong);
  if (pending) return pending;

  const p = (async () => {
    const result = await generate(study);
    if (result) cache.set(study.strong, result);
    inFlight.delete(study.strong);
    return result;
  })();

  inFlight.set(study.strong, p);
  return p;
}

/** True when the gateway is configured; lets the route short-circuit. */
export function wordUsageConfigured(): boolean {
  return pipeLlmConfigured();
}
