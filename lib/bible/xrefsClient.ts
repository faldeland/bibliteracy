// Client-side loader for the packed cross-references binaries produced by
// `scripts/buildCrossRefs.ts`. The fetch is deduplicated per variant across
// consumers so /atlas + an embedded mini-strip in BibleReader share the
// same parse cost, and flipping the Atlas toggle a second time is free.
//
// Two variants ship:
//   • "recognized" — the 63,779 high-confidence pairs (top-N by OpenBible
//     community votes). This mirrors the Harrison/Römhild 2007 count and
//     is the Atlas default.
//   • "all"        — the full ~343k-arc firehose (votes >= 0).
//
// Format (must stay in sync with scripts/buildCrossRefs.ts):
//   public/data/xrefs(.recognized)?.bin       — Uint32Array of [from, to, …]
//   public/data/xrefs(.recognized)?.meta.json — { count, votesMin, … }

export type XRefVariant = "recognized" | "all";

export const DEFAULT_XREF_VARIANT: XRefVariant = "recognized";

export interface XRefMeta {
  variant?: XRefVariant;
  count: number;
  minVotesFilter: number;
  votesMin: number | null;
  votesMax: number | null;
  totalVerses: number;
  builtAt: string;
  sourceSha256: string;
  sourceUrl: string;
  license: string;
  /** Only set on the recognized variant. */
  recognizedTarget?: number;
  /** Effective votes >= threshold for the recognized cut. */
  recognizedEffectiveThreshold?: number | null;
}

export interface XRefData {
  /** Flat pairs: pairs[i*2] = fromIdx, pairs[i*2+1] = toIdx. */
  pairs: Uint32Array;
  meta: XRefMeta;
  variant: XRefVariant;
}

const cache = new Map<XRefVariant, Promise<XRefData>>();

function pathsFor(variant: XRefVariant): { bin: string; meta: string } {
  const stem = variant === "recognized" ? "xrefs.recognized" : "xrefs";
  return { bin: `/data/${stem}.bin`, meta: `/data/${stem}.meta.json` };
}

/** True when at least one packed pair touches `verseIdx`. */
export function verseHasCrossRefs(
  pairs: Uint32Array,
  verseIdx: number,
): boolean {
  return countVerseCrossRefs(pairs, verseIdx) > 0;
}

/** Count packed pairs touching `verseIdx`. */
export function countVerseCrossRefs(
  pairs: Uint32Array,
  verseIdx: number,
): number {
  let n = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    if (pairs[i] === verseIdx || pairs[i + 1] === verseIdx) n += 1;
  }
  return n;
}

export function loadCrossReferences(
  variant: XRefVariant = DEFAULT_XREF_VARIANT,
): Promise<XRefData> {
  const existing = cache.get(variant);
  if (existing) return existing;
  const { bin, meta } = pathsFor(variant);
  const promise = (async () => {
    const [binRes, metaRes] = await Promise.all([fetch(bin), fetch(meta)]);
    if (!binRes.ok) throw new Error(`${bin}: HTTP ${binRes.status}`);
    if (!metaRes.ok) throw new Error(`${meta}: HTTP ${metaRes.status}`);
    const [buf, metaJson] = await Promise.all([
      binRes.arrayBuffer(),
      metaRes.json() as Promise<XRefMeta>,
    ]);
    const pairs = new Uint32Array(buf);
    if (pairs.length !== metaJson.count * 2) {
      // Defensive: a stale meta.json against a freshly-rebuilt bin (or vice
      // versa) would silently produce nonsense arcs; fail loud instead.
      throw new Error(
        `xrefs(${variant}): meta.count=${metaJson.count} but bin has ${
          pairs.length / 2
        } pairs`,
      );
    }
    return { pairs, meta: metaJson, variant };
  })();
  cache.set(variant, promise);
  return promise;
}
