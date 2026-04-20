// Client-side loader for the packed cross-references binary produced by
// `scripts/buildCrossRefs.ts`. The fetch is deduplicated across consumers so
// /atlas + an embedded mini-strip in BibleReader share the same parse cost.
//
// Format (must stay in sync with scripts/buildCrossRefs.ts):
//   public/data/xrefs.bin       — raw Uint32Array of [from, to, from, to, ...]
//   public/data/xrefs.meta.json — { count, votesMin, votesMax, ... }

export interface XRefMeta {
  count: number;
  minVotesFilter: number;
  votesMin: number | null;
  votesMax: number | null;
  totalVerses: number;
  builtAt: string;
  sourceSha256: string;
  sourceUrl: string;
  license: string;
}

export interface XRefData {
  /** Flat pairs: pairs[i*2] = fromIdx, pairs[i*2+1] = toIdx. */
  pairs: Uint32Array;
  meta: XRefMeta;
}

let cached: Promise<XRefData> | null = null;

export function loadCrossReferences(): Promise<XRefData> {
  if (cached) return cached;
  cached = (async () => {
    const [binRes, metaRes] = await Promise.all([
      fetch("/data/xrefs.bin"),
      fetch("/data/xrefs.meta.json"),
    ]);
    if (!binRes.ok) throw new Error(`xrefs.bin: HTTP ${binRes.status}`);
    if (!metaRes.ok) throw new Error(`xrefs.meta.json: HTTP ${metaRes.status}`);
    const [buf, meta] = await Promise.all([
      binRes.arrayBuffer(),
      metaRes.json() as Promise<XRefMeta>,
    ]);
    const pairs = new Uint32Array(buf);
    if (pairs.length !== meta.count * 2) {
      // Defensive: a stale meta.json against a freshly-rebuilt bin (or vice
      // versa) would silently produce nonsense arcs; fail loud instead.
      throw new Error(
        `xrefs: meta.count=${meta.count} but bin has ${pairs.length / 2} pairs`,
      );
    }
    return { pairs, meta };
  })();
  return cached;
}
