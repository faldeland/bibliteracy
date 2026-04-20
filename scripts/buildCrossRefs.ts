/**
 * Offline build step that turns the OpenBible.info cross-references TSV
 * (CC BY 4.0, ~344k pairs) into a packed binary blob the canvas firehose
 * can mmap-fast at runtime.
 *
 * Inputs (in priority order):
 *   1. data/sources/cross_references.txt   ← committed for reproducibility
 *   2. fresh download from openbible.info  ← if (1) is missing
 *
 * Outputs:
 *   public/data/xrefs.bin        — Uint32Array of pairs [fromIdx, toIdx, ...]
 *   public/data/xrefs.meta.json  — { count, votesMin, votesMax, builtAt, ... }
 *
 * Usage:
 *   npx tsx scripts/buildCrossRefs.ts                   # default: votes >= 0
 *   npx tsx scripts/buildCrossRefs.ts --min-votes=1     # higher-confidence cut
 *   npx tsx scripts/buildCrossRefs.ts --refresh         # force re-download
 *
 * The script is intentionally dependency-free: we don't add a TSV parser
 * or a zip dependency at runtime; we only use Node built-ins so this can
 * run in CI without enlarging the production bundle.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { verseIndex, TOTAL_VERSES } from "../lib/bible/globalVerseIndex";
import { BIBLE_BOOKS } from "../lib/bible/books";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE_PATH = resolve(ROOT, "data/sources/cross_references.txt");
const OUT_BIN = resolve(ROOT, "public/data/xrefs.bin");
const OUT_META = resolve(ROOT, "public/data/xrefs.meta.json");

// OpenBible.info publishes the dataset as a gzipped TSV at this URL.
// (As of 2026: served from `a.openbible.info`.)
const SOURCE_URL = "https://a.openbible.info/data/cross-references.zip";

// ── OSIS → our short book IDs ──────────────────────────────────────────────
//
// OpenBible uses OSIS-ish book identifiers ("Gen", "Exod", "Ps", "1Cor",
// "Phlm", "Rev", etc.). Our `BIBLE_BOOKS` uses the same 3-letter family
// most of the time but with small differences:
//   • OT prophets / writings: `Eze`, `Joe`, `Mal`, `Jdg`, etc. (3 letters)
//   • Psalms: we use `Psa`, OpenBible uses `Ps`
//   • Gospels: we use `Mat`/`Mrk`/`Luk`/`Jhn`, OpenBible uses `Matt`/`Mark`/`Luke`/`John`
//   • Numbered books: we use `1Sa`/`1Ki`/`1Co`/`1Th`/`1Pe`/`1Jn`/`2Co` etc.,
//     OpenBible uses `1Sam`/`1Kgs`/`1Cor`/`1Thess`/`1Pet`/`1John`/`2Cor`.
//
// Anything not in this map (e.g. apocryphal books like `Sir`, `Tob`, `1Macc`)
// is silently skipped — we only carry the 66-book Protestant canon.
const OSIS_TO_OURS: Record<string, string> = {
  Gen: "Gen",
  Exod: "Exo",
  Lev: "Lev",
  Num: "Num",
  Deut: "Deu",
  Josh: "Jos",
  Judg: "Jdg",
  Ruth: "Rut",
  "1Sam": "1Sa",
  "2Sam": "2Sa",
  "1Kgs": "1Ki",
  "2Kgs": "2Ki",
  "1Chr": "1Ch",
  "2Chr": "2Ch",
  Ezra: "Ezr",
  Neh: "Neh",
  Esth: "Est",
  Job: "Job",
  Ps: "Psa",
  Prov: "Pro",
  Eccl: "Ecc",
  Song: "Sng",
  Isa: "Isa",
  Jer: "Jer",
  Lam: "Lam",
  Ezek: "Eze",
  Dan: "Dan",
  Hos: "Hos",
  Joel: "Joe",
  Amos: "Amo",
  Obad: "Oba",
  Jonah: "Jon",
  Mic: "Mic",
  Nah: "Nah",
  Hab: "Hab",
  Zeph: "Zep",
  Hag: "Hag",
  Zech: "Zec",
  Mal: "Mal",
  Matt: "Mat",
  Mark: "Mrk",
  Luke: "Luk",
  John: "Jhn",
  Acts: "Act",
  Rom: "Rom",
  "1Cor": "1Co",
  "2Cor": "2Co",
  Gal: "Gal",
  Eph: "Eph",
  Phil: "Php",
  Col: "Col",
  "1Thess": "1Th",
  "2Thess": "2Th",
  "1Tim": "1Ti",
  "2Tim": "2Ti",
  Titus: "Tit",
  Phlm: "Phm",
  Heb: "Heb",
  Jas: "Jas",
  "1Pet": "1Pe",
  "2Pet": "2Pe",
  "1John": "1Jn",
  "2John": "2Jn",
  "3John": "3Jn",
  Jude: "Jud",
  Rev: "Rev",
};

// Sanity check at startup so a typo in the map fails loud, not silent.
for (const ours of Object.values(OSIS_TO_OURS)) {
  if (!BIBLE_BOOKS.some((b) => b.id === ours)) {
    throw new Error(`OSIS_TO_OURS targets unknown book id: ${ours}`);
  }
}

// ── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = new Map<string, string>();
for (const a of args) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) argMap.set(m[1], m[2] ?? "true");
}
const MIN_VOTES = Number(argMap.get("min-votes") ?? "0");
const FORCE_REFRESH = argMap.get("refresh") === "true";

// ── Source acquisition ────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function loadSourceText(): Promise<string> {
  if (!FORCE_REFRESH && (await fileExists(SOURCE_PATH))) {
    process.stdout.write(`reading ${SOURCE_PATH}\n`);
    return await readFile(SOURCE_PATH, "utf8");
  }
  process.stdout.write(`downloading ${SOURCE_URL}\n`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`fetch ${SOURCE_URL} → HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // The published asset is a .zip wrapping a single .txt. Rather than pull
  // in a zip dep, try gunzip first (some mirrors serve .gz); if that fails,
  // try to unwrap the zip by hand for the trivial single-file case.
  let text: string;
  try {
    text = gunzipSync(buf).toString("utf8");
  } catch {
    text = unwrapSimpleZip(buf);
  }
  await mkdir(dirname(SOURCE_PATH), { recursive: true });
  await writeFile(SOURCE_PATH, text, "utf8");
  process.stdout.write(`cached source → ${SOURCE_PATH}\n`);
  return text;
}

/**
 * Minimal "extract first text file" decoder for STORED or DEFLATED zips.
 * Avoids pulling in a dependency for what is, in practice, a single-file
 * archive. Throws if the layout isn't what we expect so the failure is
 * obvious instead of corrupting the cache.
 */
function unwrapSimpleZip(buf: Buffer): string {
  // Local file header signature
  const SIG = 0x04034b50;
  if (buf.readUInt32LE(0) !== SIG) {
    throw new Error("downloaded asset is neither gzip nor a zip we can read");
  }
  const compressionMethod = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const fileNameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + fileNameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) return data.toString("utf8");
  if (compressionMethod === 8) {
    // raw DEFLATE — wrap with a stub gzip header is overkill; use inflateRawSync.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { inflateRawSync } = require("node:zlib") as typeof import("node:zlib");
    return inflateRawSync(data).toString("utf8");
  }
  throw new Error(`zip compression method ${compressionMethod} not supported`);
}

// ── Parsing ───────────────────────────────────────────────────────────────

interface ParsedRow {
  fromIdx: number;
  toIdx: number;
  votes: number;
}

const VERSE_RE = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/;

interface ParsedRef {
  bookId: string;
  chapter: number;
  verse: number;
}

function parseSingleVerse(token: string): ParsedRef | null {
  const m = VERSE_RE.exec(token);
  if (!m) return null;
  const ours = OSIS_TO_OURS[m[1]];
  if (!ours) return null;
  return { bookId: ours, chapter: Number(m[2]), verse: Number(m[3]) };
}

/**
 * OpenBible's `From Verse` is always a single verse. `To Verse` may be a
 * single verse OR a hyphenated range like `Gen.1.1-Gen.1.3`. We expand
 * ranges into multiple pairs so the canvas can treat every arc uniformly.
 *
 * Returns the (start, end) verse-index pair plus the source's votes.
 */
function expandRow(
  fromTok: string,
  toTok: string,
  votes: number,
): ParsedRow[] {
  const from = parseSingleVerse(fromTok);
  if (!from) return [];
  const fromIdx = verseIndex(from.bookId, from.chapter, from.verse);
  if (fromIdx == null) return [];

  let toStart: ParsedRef | null;
  let toEnd: ParsedRef | null;
  const dash = toTok.indexOf("-");
  if (dash === -1) {
    toStart = parseSingleVerse(toTok);
    toEnd = toStart;
  } else {
    toStart = parseSingleVerse(toTok.slice(0, dash));
    toEnd = parseSingleVerse(toTok.slice(dash + 1));
  }
  if (!toStart || !toEnd) return [];
  if (toStart.bookId !== toEnd.bookId) return []; // skip cross-book ranges

  const startIdx = verseIndex(toStart.bookId, toStart.chapter, toStart.verse);
  const endIdx = verseIndex(toEnd.bookId, toEnd.chapter, toEnd.verse);
  if (startIdx == null || endIdx == null) return [];

  // Use the midpoint of the target range as the destination. Keeps the
  // visualization to one arc per source row instead of fanning ranges.
  const toIdx = Math.round((startIdx + endIdx) / 2);
  return [{ fromIdx, toIdx, votes }];
}

function parseTSV(text: string): ParsedRow[] {
  const out: ParsedRow[] = [];
  let dropped = 0;
  let lineNo = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    lineNo++;
    if (!rawLine || rawLine.startsWith("#")) continue;
    if (lineNo === 1 && /^From/i.test(rawLine)) continue; // header
    const cols = rawLine.split("\t");
    if (cols.length < 2) continue;
    const votes = cols.length >= 3 ? Number(cols[2]) : 0;
    if (!Number.isFinite(votes)) continue;
    const expanded = expandRow(cols[0], cols[1], votes);
    if (expanded.length === 0) dropped++;
    else out.push(...expanded);
  }
  process.stdout.write(
    `parsed ${out.length.toLocaleString()} rows (dropped ${dropped.toLocaleString()} unmappable)\n`,
  );
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const text = await loadSourceText();
  const rows = parseTSV(text);

  const filtered = rows.filter((r) => r.votes >= MIN_VOTES);
  process.stdout.write(
    `kept ${filtered.length.toLocaleString()} rows (votes >= ${MIN_VOTES})\n`,
  );

  // Sanity: every index must be in range.
  for (const r of filtered) {
    if (r.fromIdx < 0 || r.fromIdx >= TOTAL_VERSES) {
      throw new Error(`fromIdx ${r.fromIdx} out of range`);
    }
    if (r.toIdx < 0 || r.toIdx >= TOTAL_VERSES) {
      throw new Error(`toIdx ${r.toIdx} out of range`);
    }
  }

  // Pack as Uint32Array of [from, to, from, to, ...]. We don't pack votes
  // — the renderer doesn't need them at draw time, and keeping the binary
  // small dominates. Vote stats live in the meta JSON.
  const packed = new Uint32Array(filtered.length * 2);
  for (let i = 0; i < filtered.length; i++) {
    packed[i * 2] = filtered[i].fromIdx;
    packed[i * 2 + 1] = filtered[i].toIdx;
  }
  const bin = Buffer.from(packed.buffer, packed.byteOffset, packed.byteLength);

  const votesMin = filtered.reduce(
    (m, r) => Math.min(m, r.votes),
    Number.POSITIVE_INFINITY,
  );
  const votesMax = filtered.reduce(
    (m, r) => Math.max(m, r.votes),
    Number.NEGATIVE_INFINITY,
  );
  const sourceSha = createHash("sha256").update(text).digest("hex");

  const meta = {
    count: filtered.length,
    minVotesFilter: MIN_VOTES,
    votesMin: Number.isFinite(votesMin) ? votesMin : null,
    votesMax: Number.isFinite(votesMax) ? votesMax : null,
    totalVerses: TOTAL_VERSES,
    builtAt: new Date().toISOString(),
    sourceSha256: sourceSha,
    sourceUrl: SOURCE_URL,
    license: "CC BY 4.0 — © OpenBible.info",
  };

  await mkdir(dirname(OUT_BIN), { recursive: true });
  await writeFile(OUT_BIN, bin);
  await writeFile(OUT_META, JSON.stringify(meta, null, 2) + "\n");

  process.stdout.write(
    `wrote ${OUT_BIN} (${(bin.length / 1024).toFixed(1)} KB)\n`,
  );
  process.stdout.write(`wrote ${OUT_META}\n`);
}

main().catch((err) => {
  process.stderr.write(String((err as Error).stack ?? err) + "\n");
  process.exit(1);
});
