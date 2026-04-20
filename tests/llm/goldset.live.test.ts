/**
 * Live gold-standard regression test.
 *
 * Hits the real PipeLLM gateway against a small curated set of
 * Hebrew and Greek Strong's numbers and asserts the end-to-end
 * contract:
 *
 *   1. The feature is configured (PIPELLM_API_KEY + dev server).
 *   2. A result actually comes back (no refusal, no error).
 *   3. Every `source.citation` names a work on the trusted scholarly
 *      allowlist.
 *   4. For language-appropriate entries, at least one of the
 *      expected anchor works appears in the citation list.
 *
 * Skipped by default. Run with:
 *
 *     RUN_LIVE_REGRESSION=1 PIPELLM_API_KEY=... \
 *       LIVE_BASE_URL=http://localhost:3000 \
 *       npx vitest run tests/llm/goldset.live.test.ts
 *
 * Expect ~30–60s wall time per run (3 usage calls + 3 deep-dive calls,
 * each paying for generation + audit).
 */

import { describe, expect, it } from "vitest";
import { matchTrustedWork } from "@/lib/llm/trustedSources";

const GOLD_SET: Array<{
  strong: string;
  language: "Hebrew" | "Greek";
  /** At least one of these abbreviations should appear in the citations. */
  anchor: string[];
}> = [
  // New Testament, well-attested Greek words
  { strong: "G3056", language: "Greek", anchor: ["BDAG", "LSJ", "TDNT", "Thayer"] },
  { strong: "G26", language: "Greek", anchor: ["BDAG", "TDNT", "NIDNTTE"] },
  { strong: "G40", language: "Greek", anchor: ["BDAG", "TDNT", "Thayer"] },

  // Old Testament, well-attested Hebrew words
  { strong: "H430", language: "Hebrew", anchor: ["BDB", "HALOT", "TDOT", "DCH"] },
  { strong: "H7225", language: "Hebrew", anchor: ["BDB", "HALOT", "TDOT"] },
  { strong: "H1254", language: "Hebrew", anchor: ["BDB", "HALOT", "DCH"] },
];

const RUN = process.env.RUN_LIVE_REGRESSION === "1";
const BASE = process.env.LIVE_BASE_URL ?? "http://localhost:3000";

const d = RUN ? describe : describe.skip;

interface UsageResp {
  configured: boolean;
  usage: {
    sources: Array<{ citation: string }>;
    refusalReason: string | null;
    period: string;
    commonUsage: string;
  } | null;
}

interface DeepResp {
  configured: boolean;
  deepDive: {
    sources: Array<{ citation: string }>;
    refusalReason: string | null;
    summary: string;
    semanticRange: Array<{ label: string }>;
  } | null;
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return (await r.json()) as T;
}

function assertAllTrusted(citations: string[], ctx: string) {
  for (const c of citations) {
    const work = matchTrustedWork(c);
    if (!work) {
      throw new Error(
        `${ctx}: citation "${c}" does not match any trusted work`,
      );
    }
  }
}

function assertAnchorPresent(citations: string[], anchors: string[], ctx: string) {
  const hit = citations.find((c) =>
    anchors.some((a) => c.toLowerCase().includes(a.toLowerCase())),
  );
  if (!hit) {
    throw new Error(
      `${ctx}: expected at least one of [${anchors.join(", ")}] in citations, got ${JSON.stringify(citations)}`,
    );
  }
}

d("gold-set: /api/bible/usage", () => {
  for (const entry of GOLD_SET) {
    it(`${entry.strong} (${entry.language}) returns trusted, anchored sources`, async () => {
      const j = await getJson<UsageResp>(
        `/api/bible/usage?strong=${entry.strong}`,
      );
      expect(j.configured).toBe(true);
      expect(j.usage).not.toBeNull();
      expect(j.usage?.refusalReason).toBeNull();
      expect(j.usage?.commonUsage.length).toBeGreaterThan(20);

      const citations = j.usage!.sources.map((s) => s.citation);
      expect(citations.length).toBeGreaterThan(0);
      assertAllTrusted(citations, `usage:${entry.strong}`);
      assertAnchorPresent(citations, entry.anchor, `usage:${entry.strong}`);
    }, 60_000);
  }
});

d("gold-set: /api/bible/deep-dive", () => {
  for (const entry of GOLD_SET) {
    it(`${entry.strong} (${entry.language}) returns trusted, anchored sources`, async () => {
      const j = await getJson<DeepResp>(
        `/api/bible/deep-dive?strong=${entry.strong}`,
      );
      expect(j.configured).toBe(true);
      expect(j.deepDive).not.toBeNull();
      expect(j.deepDive?.refusalReason).toBeNull();
      expect(j.deepDive?.summary.length).toBeGreaterThan(20);
      expect((j.deepDive?.semanticRange.length ?? 0)).toBeGreaterThanOrEqual(1);

      const citations = j.deepDive!.sources.map((s) => s.citation);
      expect(citations.length).toBeGreaterThan(0);
      assertAllTrusted(citations, `deep-dive:${entry.strong}`);
      assertAnchorPresent(
        citations,
        entry.anchor,
        `deep-dive:${entry.strong}`,
      );
    }, 90_000);
  }
});
