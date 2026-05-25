/**
 * Offline build: scan the KJV (Strong's-tagged) and emit a packed concordance.
 *
 * Inputs (in priority order):
 *   1. data/sources/kjv.json   ← committed snapshot for reproducibility
 *   2. fresh download from bolls.life/static/translations/KJV.json
 *
 * Outputs:
 *   public/data/strongs.bin       — Uint32 global-verse indices, grouped by Strong's
 *   public/data/strongs.meta.json — per-Strong's { offset, count } in canon sort order
 *
 * Usage:
 *   npx tsx scripts/buildStrongsIndex.ts
 *   npx tsx scripts/buildStrongsIndex.ts --refresh
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bookForBollsId, parseVerseTokens } from "../lib/bible/bollsApi";
import { verseIndex } from "../lib/bible/globalVerseIndex";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE_PATH = resolve(ROOT, "data/sources/kjv.json");
const OUT_BIN = resolve(ROOT, "public/data/strongs.bin");
const OUT_META = resolve(ROOT, "public/data/strongs.meta.json");
const KJV_URL = "https://bolls.life/static/translations/KJV.json";

interface KjvRow {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

function strongSortKey(a: string, b: string): number {
  const pa = a[0] === "H" ? 0 : 1;
  const pb = b[0] === "H" ? 0 : 1;
  if (pa !== pb) return pa - pb;
  const na = Number(a.slice(1));
  const nb = Number(b.slice(1));
  return na - nb;
}

async function loadKjv(refresh: boolean): Promise<KjvRow[]> {
  let useCache = false;
  if (!refresh) {
    try {
      const st = await stat(SOURCE_PATH);
      useCache = st.isFile() && st.size > 0;
    } catch {
      useCache = false;
    }
  }

  if (useCache) {
    console.log(`Reading cached ${SOURCE_PATH}`);
    return JSON.parse(await readFile(SOURCE_PATH, "utf8")) as KjvRow[];
  }

  console.log(`Downloading ${KJV_URL} …`);
  const res = await fetch(KJV_URL);
  if (!res.ok) {
    throw new Error(`KJV download failed: HTTP ${res.status}`);
  }
  const rows = (await res.json()) as KjvRow[];
  await mkdir(dirname(SOURCE_PATH), { recursive: true });
  await writeFile(SOURCE_PATH, JSON.stringify(rows));
  console.log(`Cached ${rows.length} verses → ${SOURCE_PATH}`);
  return rows;
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const rows = await loadKjv(refresh);

  /** strong → sorted unique global verse indices */
  const byStrong = new Map<string, Set<number>>();

  for (const row of rows) {
    const book = bookForBollsId(row.book);
    if (!book) continue;
    const testament = book.testament;
    const { tokens } = parseVerseTokens(row.text, testament);
    const gvi = verseIndex(book.id, row.chapter, row.verse);
    if (gvi === null) continue;

    const seenInVerse = new Set<string>();
    for (const tok of tokens) {
      if (!tok.strong || seenInVerse.has(tok.strong)) continue;
      seenInVerse.add(tok.strong);
      let set = byStrong.get(tok.strong);
      if (!set) {
        set = new Set();
        byStrong.set(tok.strong, set);
      }
      set.add(gvi);
    }
  }

  const strongs = Array.from(byStrong.keys()).sort(strongSortKey);
  const index: Record<string, { offset: number; count: number }> = {};
  const flat: number[] = [];
  let totalHits = 0;

  for (const strong of strongs) {
    const indices = Array.from(byStrong.get(strong)!).sort((a, b) => a - b);
    index[strong] = { offset: flat.length, count: indices.length };
    flat.push(...indices);
    totalHits += indices.length;
  }

  const buf = Buffer.alloc(flat.length * 4);
  for (let i = 0; i < flat.length; i++) {
    buf.writeUInt32LE(flat[i]!, i * 4);
  }

  const sha256 = createHash("sha256").update(buf).digest("hex");

  await mkdir(dirname(OUT_BIN), { recursive: true });
  await writeFile(OUT_BIN, buf);
  await writeFile(
    OUT_META,
    JSON.stringify(
      {
        version: 1,
        source: "KJV",
        strongCount: strongs.length,
        totalHits,
        sha256,
        index,
      },
      null,
      2,
    ),
  );

  console.log(
    `Wrote ${strongs.length} Strong's entries, ${totalHits.toLocaleString()} verse hits`,
  );
  console.log(`  ${OUT_BIN} (${(buf.length / 1024 / 1024).toFixed(2)} MiB)`);
  console.log(`  ${OUT_META}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
