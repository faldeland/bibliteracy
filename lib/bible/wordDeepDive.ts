/**
 * Server-side generator for the "AI Assistant" deep-dive panel on the
 * word-study popover. Produces a thorough, multi-section scholarly study
 * of a Hebrew or Greek word keyed by Strong's number.
 *
 * Transport, model selection, and the global truth-rules system prompt
 * live in `lib/llm/pipellm.ts` + `lib/llm/truthRules.ts`. This module only
 * owns the schema, the feature-specific instructions, the validator, and
 * the per-Strong's in-memory cache.
 *
 * Configure the model with `PIPELLM_MODEL_WORD_DEEP_DIVE` (falls back to
 * `PIPELLM_MODEL_DEFAULT`, then the hardcoded default `gpt-4o`).
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

// ─── Public shape ───────────────────────────────────────────────────────────

export interface Morphology {
  partOfSpeech: string;
  /** Hebrew: stem (Qal, Niphal, etc.). Greek: voice/mood/tense hint if salient. */
  stem: string | null;
  /** Root / derivation info when uncontroversial. */
  root: string | null;
  /** Short grammar note — what the lexica say about how this word behaves. */
  notes: string | null;
}

export interface SemanticSense {
  /** Short label: "to create, shape", "word, message", "deity, god". */
  label: string;
  /** 1–3 sentence description grounded in the lexica. */
  description: string;
  /** A handful of representative occurrences, with book/chap/verse and gloss. */
  examples: Array<{ ref: string; gloss: string }>;
}

export interface RelatedEntry {
  /** Another Strong's number (H#### / G####). */
  strong: string;
  /** Lemma if known, otherwise empty string. */
  lemma: string;
  /** Nature of the relation: "cognate", "antonym", "derived from", etc. */
  relation: string;
}

export interface WordDeepDive {
  strong: string;
  /** Lemma carried through from the word study, for UI header. */
  lemma: string;
  /** One-sentence headline summary of the word's significance. */
  summary: string;
  morphology: Morphology;
  semanticRange: SemanticSense[];
  /** Period usage note — like the popover's, but allowed to be longer. */
  periodUsage: { period: string; description: string } | null;
  /** Theological significance, if the word carries one. Null when not applicable. */
  theologicalSignificance: string | null;
  /** Notable translation-history notes (e.g. KJV vs ESV vs NIV choices). */
  translationNotes: string | null;
  /** Cognate / related Strong's numbers the reader might want to explore. */
  relatedEntries: RelatedEntry[];
  /** Sources attested under the global truth-rules protocol. */
  sources: Source[];
  /** Populated if the model took the refusal path. */
  refusalReason: string | null;
  /**
   * Optional one-sentence caveat from the global §7 uncertainty protocol.
   * Null when the overall claim set is well-attested.
   */
  uncertainty: string | null;
  /** Model slug PipeLLM routed to. */
  model: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const cache = new Map<string, WordDeepDive>();
const inFlight = new Map<string, Promise<WordDeepDive | null>>();

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildMessages(
  study: WordStudy,
  retrieved: RetrievedEntry,
): ChatMessage[] {
  const isHebrew = study.strong.startsWith("H");
  const corpus = isHebrew
    ? "Biblical Hebrew, with Septuagint reception and Northwest Semitic cognate evidence (Ugaritic, Aramaic, Akkadian) when it sharpens a sense"
    : "Koine Greek of the 1st century AD, with Septuagint reception, papyri, and Greco-Roman literary evidence when it sharpens a sense";
  const grammarHint = isHebrew
    ? "For verbs, identify the stem when relevant (Qal, Niphal, Piel, Pual, Hiphil, Hophal, Hithpael). For nouns, note gender & number if lexicographically salient."
    : "For verbs, note voice/mood/aspect only when it materially affects the sense. For nouns, note gender and declension only when lexicographically salient.";

  const trustedGroup = isHebrew
    ? "HALOT, BDB, DCH, TDOT, TWOT, NIDOTTE, Holladay, Jastrow (Aramaic), plus GKC / Joüon-Muraoka / Waltke-O'Connor for grammar"
    : "BDAG, LSJ, Louw-Nida, Moulton-Milligan, TDNT, EDNT, NIDNTTE, Thayer (older — use sparingly), plus Wallace / BDF / Robertson for grammar";

  const system = [
    "You are a careful biblical lexicographer writing a deep-dive word",
    "study for an educated but non-specialist reader. The global",
    "truthfulness and citation rules in the first system message are in",
    "force; every section of your answer must be groundable in real",
    "published scholarship from the §6 trusted-source inventory, and",
    "the `sources` array must list the works you actually drew on.",
    "",
    "Write in a neutral, scholarly tone — informative, not devotional.",
    "Prefer concrete, dated evidence over abstract taxonomy. When",
    "scholars disagree, say so in one clause and name the positions; do",
    "not pick a side.",
    "",
    `Ground every claim in ${corpus}, and cross-check against the`,
    `primary authorities for this language family: ${trustedGroup}.`,
    "",
    "Do not cite Strong's Concordance, Vine's, study-Bible notes,",
    "devotional commentaries, blogs, Bible-software platforms, or any",
    "other source listed under §6.4 prohibited categories. Cite the",
    "underlying lexicon or grammar itself, not the website or app that",
    "hosts it — if you quote a BDAG entry through STEP Bible, the",
    "citation names BDAG and the url (if any) points to the STEP entry.",
    "",
    grammarHint,
    "",
    "Respond with a single JSON object — no markdown fences, no prose",
    "outside the JSON — matching this schema in addition to the global",
    "`sources` and optional `refusal_reason`:",
    "",
    "type Out = {",
    '  summary: string;                        // 1 sentence headline',
    "  morphology: {",
    '    part_of_speech: string;               // "noun", "verb", …',
    "    stem: string | null;",
    "    root: string | null;",
    '    notes: string | null;                 // short grammar note',
    "  };",
    "  semantic_range: Array<{",
    '    label: string;                        // short sense label',
    '    description: string;                  // 1-3 sentences',
    "    examples: Array<{",
    '      ref: string;                        // "Gen 1:1", "John 1:1"',
    '      gloss: string;                      // short English rendering',
    "    }>;",
    "  }>;",
    "  period_usage: { period: string; description: string } | null;",
    "  theological_significance: string | null;",
    "  translation_notes: string | null;",
    "  related_entries: Array<{",
    '    strong: string;                       // "H####" or "G####"',
    "    lemma: string;",
    '    relation: string;                     // "cognate", "derived from", …',
    "  }>;",
    "  sources: Source[];                      // REQUIRED by global rules",
    "  refusal_reason?: string;",
    "};",
    "",
    "Constraints on content:",
    "",
    "  • 2–5 items in semantic_range, ordered from most common to least.",
    "  • 0–3 examples per sense, each a canonical, widely-recognized verse.",
    "  • 0–6 related_entries; only include entries you are confident",
    "    actually exist at that Strong's number. Otherwise omit.",
    "  • theological_significance and translation_notes may be null when",
    "    the word is lexically ordinary.",
    "  • If you cannot cite at least two works from §6.3 (prefer one",
    "    lexicon + one grammar, or two lexica), use the global refusal",
    "    protocol: empty strings / arrays + refusal_reason.",
    "  • Citations should be lookup-style: 'BDAG, s.v. <lemma>',",
    "    'HALOT 1:137, s.v. <lemma>', 'TDNT 4:102–114', 'Wallace,",
    "    GGBB, pp. 388–389'.",
  ].join("\n");

  const user = [
    `Strong's: ${study.strong}`,
    `Lemma: ${study.lexeme}`,
    `Transliteration: ${study.transliteration}`,
    `Pronunciation: ${study.pronunciation}`,
    `Standard biblical gloss: ${study.shortGloss}`,
    formatRetrievedBlock(retrieved),
    "",
    "Produce the deep-dive JSON for this word.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

// ─── Schema validation ──────────────────────────────────────────────────────

interface LlmShape {
  summary: string;
  morphology: {
    part_of_speech?: string;
    stem?: string | null;
    root?: string | null;
    notes?: string | null;
  };
  semantic_range: Array<{
    label: string;
    description: string;
    examples?: Array<{ ref?: string; gloss?: string }>;
  }>;
  period_usage?: { period?: string; description?: string } | null;
  theological_significance?: string | null;
  translation_notes?: string | null;
  related_entries?: Array<{
    strong?: string;
    lemma?: string;
    relation?: string;
  }>;
}

const STRONG_RE = /^[GH]\d+$/;

function validate(raw: unknown): LlmShape | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LlmShape>;
  if (typeof r.summary !== "string") return null;
  if (!r.morphology || typeof r.morphology !== "object") return null;
  if (!Array.isArray(r.semantic_range)) return null;
  for (const s of r.semantic_range) {
    if (!s || typeof s !== "object") return null;
    if (typeof s.label !== "string" || typeof s.description !== "string") {
      return null;
    }
  }
  return r as LlmShape;
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

async function generate(study: WordStudy): Promise<WordDeepDive | null> {
  const retrieved = buildRetrievedEntry(study.strong, study.detailHtml);
  const startedAt = Date.now();

  const result = await chatJson<LlmShape>({
    useCase: "wordDeepDive",
    messages: buildMessages(study, retrieved),
    validate,
    logTag: "wordDeepDive",
    logKey: study.strong,
  });
  if (!result) return null;

  const raw = result.data;

  const morphology: Morphology = {
    partOfSpeech: s(raw.morphology.part_of_speech) ?? "",
    stem: s(raw.morphology.stem),
    root: s(raw.morphology.root),
    notes: s(raw.morphology.notes),
  };

  const semanticRange: SemanticSense[] = raw.semantic_range.map((sense) => ({
    label: sense.label.trim(),
    description: sense.description.trim(),
    examples: Array.isArray(sense.examples)
      ? sense.examples
          .map((e) => ({
            ref: s(e?.ref) ?? "",
            gloss: s(e?.gloss) ?? "",
          }))
          .filter((e) => e.ref.length > 0)
          .slice(0, 3)
      : [],
  }));

  const periodUsage =
    raw.period_usage && typeof raw.period_usage === "object"
      ? (() => {
          const period = s(raw.period_usage?.period);
          const description = s(raw.period_usage?.description);
          if (!period || !description) return null;
          return { period, description };
        })()
      : null;

  const relatedEntries: RelatedEntry[] = Array.isArray(raw.related_entries)
    ? raw.related_entries
        .map((e) => ({
          strong: s(e?.strong)?.toUpperCase() ?? "",
          lemma: s(e?.lemma) ?? "",
          relation: s(e?.relation) ?? "",
        }))
        .filter((e) => STRONG_RE.test(e.strong) && e.relation.length > 0)
        .slice(0, 6)
    : [];

  // Belt-and-suspenders: if the model produced substantive content but no
  // sources, treat it as a refusal rather than serving uncorroborated
  // scholarship. The UI hides the drawer body and shows a diagnostic.
  const hasProse =
    raw.summary.trim().length > 0 && semanticRange.length > 0;
  const inferredRefusal =
    hasProse && result.sources.length === 0
      ? "Model returned a deep dive without any cross-reference sources; suppressed."
      : null;

  // Post-generation audit: compare the headline claims against the
  // retrieved BDB/Thayer entry. Deep-dive drafts are long, so we flatten
  // only the load-bearing fields (summary, senses, period, theology)
  // into the draft text — that keeps the auditor focused on claims that
  // actually matter for faithfulness.
  let auditRefusal: string | null = null;
  let auditVerdict: AuditVerdict = "skipped";
  let auditReason: string | null = null;
  if (hasProse && retrieved.hasContent) {
    const draftText = [
      `Summary: ${raw.summary.trim()}`,
      morphology.partOfSpeech
        ? `Part of speech: ${morphology.partOfSpeech}`
        : "",
      morphology.stem ? `Stem: ${morphology.stem}` : "",
      morphology.root ? `Root: ${morphology.root}` : "",
      "Senses:",
      ...semanticRange.map(
        (sense, i) => `  ${i + 1}. ${sense.label} — ${sense.description}`,
      ),
      periodUsage
        ? `Period usage (${periodUsage.period}): ${periodUsage.description}`
        : "",
      raw.theological_significance
        ? `Theological significance: ${raw.theological_significance}`
        : "",
      raw.translation_notes ? `Translation notes: ${raw.translation_notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const audit = await auditDraft({
      retrieved,
      draftText,
      sources: result.sources,
      logTag: "wordDeepDive",
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

  void appendAuditLog({
    useCase: "wordDeepDive",
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
    lemma: study.lexeme,
    summary: raw.summary.trim(),
    morphology,
    semanticRange,
    periodUsage,
    theologicalSignificance: s(raw.theological_significance),
    translationNotes: s(raw.translation_notes),
    relatedEntries,
    sources: result.sources,
    refusalReason,
    uncertainty: result.uncertainty,
    model: result.model,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchWordDeepDive(
  study: WordStudy,
): Promise<WordDeepDive | null> {
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

export function wordDeepDiveConfigured(): boolean {
  return pipeLlmConfigured();
}
