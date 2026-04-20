/**
 * Shared PipeLLM client.
 *
 * Every LLM-backed feature in the app routes through here so we have exactly
 * one place that knows about auth, the OpenAI-compatible wire format, JSON
 * response handling, and per-use-case model selection.
 *
 * ── Picking models per use case ──────────────────────────────────────────
 * Each feature registers a `UseCase` key below (e.g. `"wordUsage"`). The
 * operator overrides the model for a specific use case with an env var of
 * the form `PIPELLM_MODEL_<USE_CASE_IN_SHOUTY_SNAKE>`:
 *
 *     PIPELLM_MODEL_WORD_USAGE=claude-sonnet-4-20250514
 *     PIPELLM_MODEL_CROSS_REFS=gpt-4o-mini
 *
 * Resolution order, first match wins:
 *   1. The use-case-specific env var          (PIPELLM_MODEL_WORD_USAGE)
 *   2. The global default env var             (PIPELLM_MODEL_DEFAULT)
 *   3. Legacy fallbacks                       (see useCaseConfig below)
 *   4. The hardcoded default for that use case
 *
 * ── Adding a new use case ────────────────────────────────────────────────
 *   1. Add a new entry to `useCaseConfig` with a sensible default model.
 *   2. Call `chatJson({ useCase: "yourFeature", messages, ... })` from the
 *      feature's server module.
 *   3. (Optional) document the env-var name in `.env.example`.
 *
 * ── Why not use the OpenAI SDK? ──────────────────────────────────────────
 * Straight fetch is enough for chat/completions and keeps the bundle small.
 * If we ever need streaming, tool calls, or vision we can swap this for the
 * official SDK without touching any feature code — the `chatJson` shape is
 * intentionally minimal.
 *
 * ── Truth & citation rules ───────────────────────────────────────────────
 * Every call prepends `TRUTH_RULES_SYSTEM` (see `./truthRules.ts`) as the
 * first system message. That module defines the app-wide truthfulness,
 * citation, URL-allowlist, and refusal protocols; feature code cannot
 * remove it, only extend it. Every validated response surfaces
 * `sources: Source[]` and an optional `refusalReason: string`.
 */

import {
  TRUTH_RULES_SYSTEM,
  normalizeSources,
  type Source,
} from "./truthRules";

// ─── Use-case registry ───────────────────────────────────────────────────────

export type UseCase =
  | "wordUsage"
  | "wordDeepDive"
  | "citationAudit"
  | "default";

interface UseCaseDef {
  /** Fallback model used when no env var overrides it. */
  defaultModel: string;
  /**
   * Older env-var names we still honor so existing .env.local files don't
   * silently stop working after a rename. Checked in order after the new
   * name fails.
   */
  legacyEnvVars?: string[];
}

const useCaseConfig: Record<UseCase, UseCaseDef> = {
  // "In its time" note on the word-study popover. Short scholarly blurb.
  wordUsage: {
    defaultModel: "gpt-4o-mini",
    legacyEnvVars: ["PIPELLM_USAGE_MODEL"],
  },
  // "AI Assistant" deep-dive drawer on the word-study popover. Much richer
  // output (morphology, semantic range, theology, translation history,
  // related entries) — worth a stronger default model. Operators can still
  // override with PIPELLM_MODEL_WORD_DEEP_DIVE.
  wordDeepDive: {
    defaultModel: "gpt-4o",
  },
  // Post-generation adversarial fact-check. Runs a short, narrow
  // consistency check against the retrieved BDB/Thayer entry; a small,
  // fast model is plenty. Override with PIPELLM_MODEL_CITATION_AUDIT.
  citationAudit: {
    defaultModel: "gpt-4o-mini",
  },
  // Fallback bucket used when a caller doesn't care / for quick prototypes.
  default: {
    defaultModel: "gpt-4o-mini",
  },
};

function envVarFor(useCase: UseCase): string {
  // wordUsage -> PIPELLM_MODEL_WORD_USAGE
  const shouty = useCase.replace(/([A-Z])/g, "_$1").toUpperCase();
  return `PIPELLM_MODEL_${shouty}`;
}

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : null;
}

/** Resolve the model slug PipeLLM should route to for a given use case. */
export function modelFor(useCase: UseCase): string {
  const specific = readEnv(envVarFor(useCase));
  if (specific) return specific;

  if (useCase !== "default") {
    const globalDefault = readEnv(envVarFor("default"));
    if (globalDefault) return globalDefault;
  }

  for (const legacy of useCaseConfig[useCase].legacyEnvVars ?? []) {
    const v = readEnv(legacy);
    if (v) return v;
  }

  return useCaseConfig[useCase].defaultModel;
}

// ─── Transport ───────────────────────────────────────────────────────────────

// PipeLLM runs the "New API" gateway; its native OpenAI-compatible route is
// `/v1/chat/completions`. (The docs also advertise a `/openai/v1/...`
// converter path, but on this deployment that serves the frontend SPA.)
const DEFAULT_BASE = "https://api.pipellm.ai/v1";

function baseUrl(): string {
  const b = readEnv("PIPELLM_BASE_URL");
  return b ? b.replace(/\/+$/, "") : DEFAULT_BASE;
}

function apiKey(): string | null {
  return readEnv("PIPELLM_API_KEY");
}

/** True when PIPELLM_API_KEY is set. Call sites short-circuit when false. */
export function pipeLlmConfigured(): boolean {
  return apiKey() !== null;
}

// ─── chatJson ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatJsonOptions<T> {
  useCase: UseCase;
  messages: ChatMessage[];
  /**
   * Defaults to 0. These are factual scholarly tasks — we want the same
   * input to produce the same output, which makes caching behave and
   * makes the audit step meaningful. Callers can override per use case
   * if we ever add something creative.
   */
  temperature?: number;
  /**
   * Validates & narrows the parsed JSON. Returning null means the payload
   * was structurally wrong and we should treat the call as a soft failure.
   */
  validate: (raw: unknown) => T | null;
  /** Tag used in log lines so failures are debuggable. */
  logTag: string;
  /** Optional per-item key for clearer log lines (e.g. Strong's number). */
  logKey?: string;
}

export interface ChatJsonResult<T> {
  data: T;
  /**
   * Sources the model attested it drew on. Enforced globally by the truth-
   * rules system prompt (`lib/llm/truthRules.ts`) — always present, may be
   * empty only when the model took the §4 refusal path.
   */
  sources: Source[];
  /**
   * When set, the model refused to answer truthfully and returned stub
   * content. Callers should treat this as a soft failure and hide the
   * affected UI section (but may surface the reason for debugging).
   */
  refusalReason: string | null;
  /**
   * Optional uncertainty disclosure from the global §7 protocol. When
   * set, names a specific scholarly disagreement or evidentiary gap the
   * reader should know about. UI surfaces this as a caveat.
   */
  uncertainty: string | null;
  /** The exact model slug PipeLLM actually served. */
  model: string;
  /**
   * How many raw citations got dropped by the trusted-source allowlist
   * or URL sanitizer before `sources` was returned. Useful for audit
   * telemetry (e.g. "model tried to cite N non-trusted works").
   */
  strippedSources: number;
}

/**
 * Call PipeLLM's chat-completions endpoint and parse a JSON response.
 * Returns null for any failure — auth, network, non-200, malformed JSON,
 * schema mismatch. The caller decides what to do (usually: hide the
 * affected UI section and move on).
 *
 * The truth-rules system prompt is ALWAYS prepended as the first system
 * message. Feature code cannot override or remove it.
 */
export async function chatJson<T>(
  opts: ChatJsonOptions<T>,
): Promise<ChatJsonResult<T> | null> {
  const key = apiKey();
  if (!key) return null;

  const model = modelFor(opts.useCase);
  const tag = `[${opts.logTag}]`;
  const id = opts.logKey ? `${tag} ${opts.logKey}` : tag;

  // Prepend the truth-rules system prompt ahead of any feature messages.
  // It's the FIRST system message in the array, and OpenAI-compatible
  // providers treat the earliest system message as the strongest anchor.
  const messages: ChatMessage[] = [
    { role: "system", content: TRUTH_RULES_SYSTEM },
    ...opts.messages,
  ];

  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0,
    response_format: { type: "json_object" as const },
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.warn(id, "network error", err);
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(id, "pipellm non-ok", res.status, detail.slice(0, 200));
    return null;
  }

  const json = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    console.warn(id, "empty llm content");
    return null;
  }

  const parsed = parseMaybeFencedJson(content);
  if (parsed === null) {
    console.warn(id, "unparseable llm output", content.slice(0, 200));
    return null;
  }

  const validated = opts.validate(parsed);
  if (validated === null) {
    console.warn(id, "schema mismatch", content.slice(0, 200));
    return null;
  }

  // Pull the globally-required envelope fields out of the raw payload.
  // The truth-rules prompt guarantees they exist on every response.
  const envelope =
    parsed && typeof parsed === "object"
      ? (parsed as {
          sources?: unknown;
          refusal_reason?: unknown;
          uncertainty?: unknown;
        })
      : {};
  const rawSourcesLen = Array.isArray(envelope.sources)
    ? envelope.sources.length
    : 0;
  const sources = normalizeSources(envelope.sources);
  const strippedCount = rawSourcesLen - sources.length;
  if (strippedCount > 0) {
    // Something the model tried to cite didn't pass the trusted-source
    // allowlist or URL sanitization. Helpful in the dev console so we can
    // see when enforcement actually fires.
    console.info(
      id,
      "stripped",
      strippedCount,
      "of",
      rawSourcesLen,
      "source(s) (non-trusted or invalid URL)",
    );
  }

  const refusalReason =
    typeof envelope.refusal_reason === "string" &&
    envelope.refusal_reason.trim().length > 0
      ? envelope.refusal_reason.trim().slice(0, 400)
      : null;

  if (refusalReason) {
    console.info(id, "model refused:", refusalReason);
  }

  const uncertainty =
    typeof envelope.uncertainty === "string" &&
    envelope.uncertainty.trim().length > 0
      ? envelope.uncertainty.trim().slice(0, 400)
      : null;

  return {
    data: validated,
    sources,
    refusalReason,
    uncertainty,
    model,
    strippedSources: strippedCount,
  };
}

// Some providers insist on wrapping JSON in ```json fences even when
// `response_format: json_object` is set. Strip them defensively before
// parsing so we don't lose otherwise-valid output.
function parseMaybeFencedJson(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}
