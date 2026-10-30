// lib/v3c/news/image-gen.ts (#NEWSWATCH-2, -IMG) — one attempt at the card of one
// note, on Andrea's Mac: `gptimg -r` (Codex, subscription, $0), then the
// post-production of art direction (centre crop 16:9 → 1200×675 png, webp
// < 150 KB), then the visual check by `claude -p` (sonnet, Read only: the exact
// text, no face/blank face, no mark/crest), then the anti-duplicate signature.
// Used only by the news watcher, behind NEWS_WATCHER_IMAGES (off by default).
//
//  - `gptimg` strictly in SERIES (two at once steal each other's PNG — known bug
//    of the wrapper) and with stdin closed (= `</dev/null`: otherwise `codex exec`
//    waits on stdin forever when started by a script or a daemon).
//  - Post-production with macOS `sips` + `cwebp`: no Python, no npm dependency.
//  - A picture the check refuses is moved to _rejected/ (kept as evidence), never served.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { claudeArgs, readEnvelope, runClaude } from "./claude-cli";
import { IMAGE_CHECK_PROMPT, IMAGE_CHECK_SCHEMA, IMAGE_SIZE, MAX_WEBP_BYTES, readImageVerdict } from "./image";

/** gptimg measured 42–77 s (6 calls, 29/10); beyond this the attempt is lost. */
export const GPTIMG_TIMEOUT_MS = 240_000;
export const IMAGE_CHECK_MODEL = "sonnet";

export type ImageFiles = { png: string; webp: string; webpBytes: number };
/** dHash 8×8 (16 hex) + 4×4 RGB colour signature (48 numbers) of the finished png, for the anti-duplicate. */
export type ImageSig = { dhash: string; csig: number[] };
export type ImageAttempt =
  | { kind: "ok"; files: ImageFiles; ms: number; sig: ImageSig; textSeen: string; final?: boolean }
  /** this attempt failed (generation, post-production or the visual check): counts towards the cap */
  | { kind: "bad"; reason: string; ms: number; final?: boolean }
  /** the subscription said stop (checker): no attempt counted, images wait for a later run */
  | { kind: "limit"; reason: string };

export type ImageGenOpts = { dir: string; gptimg: string; cwebp: string; claudeBin: string; checkModel?: string; env?: NodeJS.ProcessEnv; hf?: HfOpts };

// ─── Higgsfield fallback (#NEWSWATCH-HF, APPROVED by Andrea 30/10) ───────────
// ONLY when gptimg says «out of credits / limit». gpt_image_2 1k LOW = 0.5 credits
// (listino 30/10: low 0.5 · medium 1 · high 3.5); 1344×752, enough for the 1200×675 crop.
// One call per note: whatever happens (fail, refused, duplicate) the note keeps its stock picture.
// Caps (0 = none) in a persistent ledger (hf-budget.json in the image dir), reserved BEFORE the call.
export const HF_CREDITS_PER_IMAGE = 0.5;
/** Higgsfield said «not now» (auth expired, no credits, rate limit), not «this picture is bad»: the note waits for a later run. */
export const HF_UNAVAILABLE_RE = /unauthori[sz]ed|not authenticated|not logged in|log ?in again|token (?:has )?expired|\b401\b|\b403\b|insufficient|not enough credits|out of credits|\b402\b|rate.?limit|\b429\b/i;
export const HF_TIMEOUT_MS = 240_000;
export type HfOpts = { bin: string; dailyMax: number; totalMax: number; log: (m: string) => void; fetch?: typeof fetch; now?: () => Date };
type HfBudget = { day: string; dayCount: number; total: number };

function readBudget(file: string): HfBudget {
  try {
    const b = JSON.parse(readFileSync(file, "utf8"));
    return { day: String(b.day ?? ""), dayCount: Number(b.dayCount) || 0, total: Number(b.total) || 0 };
  } catch {
    return { day: "", dayCount: 0, total: 0 };
  }
}

/** Reserve one Higgsfield image under the caps; null = cap reached (logged). */
export function reserveHf(dir: string, hf: HfOpts): HfBudget | null {
  const file = join(dir, "hf-budget.json");
  const day = (hf.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const b = readBudget(file);
  if (b.day !== day) Object.assign(b, { day, dayCount: 0 });
  // 0 = no cap (Andrea 30/10: «non diamo un limite»); the counters stay, for the log
  if ((hf.dailyMax > 0 && b.dayCount >= hf.dailyMax) || (hf.totalMax > 0 && b.total >= hf.totalMax)) {
    hf.log(`higgsfield: cap reached (day ${b.dayCount}/${hf.dailyMax} · total ${b.total}/${hf.totalMax}) — no call, the note keeps its stock picture`);
    return null;
  }
  b.dayCount++;
  b.total++;
  writeFileSync(file, JSON.stringify(b));
  return b;
}

type Proc = { code: number | null; out: string; err: string; ms: number; timedOut: boolean };

function run(bin: string, args: string[], opts: { cwd: string; timeoutMs: number; env?: NodeJS.ProcessEnv }): Promise<Proc> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let timedOut = false;
    let child;
    try {
      // stdin "ignore" is the `</dev/null` gptimg needs under a daemon
      child = spawn(bin, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolve({ code: -1, out, err: String(e), ms: Date.now() - t0, timedOut });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, opts.timeoutMs);
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e: Error) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: e.message, ms: Date.now() - t0, timedOut });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({ code, out, err, ms: Date.now() - t0, timedOut });
    });
  });
}

const tail = (s: string) => s.replace(/\s+/g, " ").trim().slice(-160);

/**
 * Codex said «stop for now», not «this picture is bad»: out of credits (measured 29/10:
 * «Your workspace is out of credits»), usage/rate limit, model at capacity. Not an
 * attempt: the card waits for a later run.
 */
export const GPTIMG_LIMIT_RE = /out of credits|usage limit|rate.?limit|hit your (?:[\w-]+ )?limit|at capacity|quota|\b429\b/i;

/** Centre crop to 16:9, resize to 1200×675 (sips), webp at the highest quality under 150 KB (cwebp). */
export async function postProcess(raw: string, base: string, outDir: string, cwebp: string): Promise<ImageFiles | { error: string }> {
  const dims = await run("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", raw], { cwd: outDir, timeoutMs: 30_000 });
  const w = Number(dims.out.match(/pixelWidth: (\d+)/)?.[1]);
  const h = Number(dims.out.match(/pixelHeight: (\d+)/)?.[1]);
  if (!w || !h) return { error: `sips: no size (${tail(dims.err || dims.out)})` };
  const ratio = IMAGE_SIZE.width / IMAGE_SIZE.height;
  const [ch, cw] = w / h > ratio ? [h, Math.round(h * ratio)] : [Math.round(w / ratio), w];
  const png = join(outDir, `${base}.png`);
  const crop = await run("/usr/bin/sips", ["-c", String(ch), String(cw), raw, "--out", png], { cwd: outDir, timeoutMs: 30_000 });
  if (crop.code !== 0) return { error: `sips crop: ${tail(crop.err)}` };
  const size = await run("/usr/bin/sips", ["-z", String(IMAGE_SIZE.height), String(IMAGE_SIZE.width), png], { cwd: outDir, timeoutMs: 30_000 });
  if (size.code !== 0) return { error: `sips resize: ${tail(size.err)}` };
  const webp = join(outDir, `${base}.webp`);
  for (const q of [88, 84, 80, 76, 72, 68, 64, 60, 55, 50]) {
    const c = await run(cwebp, ["-quiet", "-q", String(q), "-m", "6", "-sharp_yuv", png, "-o", webp], { cwd: outDir, timeoutMs: 60_000 });
    if (c.code !== 0) return { error: `cwebp: ${tail(c.err)}` };
    const bytes = statSync(webp).size;
    if (bytes <= MAX_WEBP_BYTES) return { png, webp, webpBytes: bytes };
  }
  return { error: `webp over ${MAX_WEBP_BYTES} bytes at q50` };
}

/** A 24-bit top-down BMP from sips → rows of [r, g, b]. */
function readBmp(buf: Buffer): number[][][] {
  const off = buf.readUInt32LE(10);
  const w = buf.readInt32LE(18);
  const hRaw = buf.readInt32LE(22);
  const h = Math.abs(hRaw);
  const bpp = buf.readUInt16LE(28) / 8;
  const stride = Math.ceil((w * bpp) / 4) * 4;
  const rows: number[][][] = [];
  for (let y = 0; y < h; y++) {
    const row: number[][] = [];
    const base = off + (hRaw < 0 ? y : h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      const p = base + x * bpp;
      row.push([buf[p + 2], buf[p + 1], buf[p]]);
    }
    rows.push(row);
  }
  return rows;
}

/** The anti-duplicate signature with macOS `sips` only (resample differs a little from art direction's PIL; thresholds rechecked on the v3 cards). */
export async function imageSignature(png: string, tmpDir: string): Promise<ImageSig | null> {
  const a = join(tmpDir, ".sig-9x8.bmp");
  const b = join(tmpDir, ".sig-4x4.bmp");
  const r1 = await run("/usr/bin/sips", ["-s", "format", "bmp", "-z", "8", "9", png, "--out", a], { cwd: tmpDir, timeoutMs: 30_000 });
  const r2 = await run("/usr/bin/sips", ["-s", "format", "bmp", "-z", "4", "4", png, "--out", b], { cwd: tmpDir, timeoutMs: 30_000 });
  if (r1.code !== 0 || r2.code !== 0) return null;
  const g = readBmp(readFileSync(a)).map((row) => row.map(([r, gg, bb]) => 0.299 * r + 0.587 * gg + 0.114 * bb));
  let bits = BigInt(0);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << BigInt(1)) | BigInt(g[y][x] > g[y][x + 1] ? 1 : 0);
  return { dhash: bits.toString(16).padStart(16, "0"), csig: readBmp(readFileSync(b)).flat(2) };
}

/** The visual check on the finished png: `claude -p` with the Read tool only, in the image's folder; the text read is compared with `expected`. */
export async function checkImage(png: string, expected: string, opts: Pick<ImageGenOpts, "claudeBin" | "checkModel" | "env">, mood?: string): Promise<{ ok: true; textSeen: string } | { ok: false; reason: string; limit?: boolean }> {
  const args = claudeArgs(opts.checkModel ?? IMAGE_CHECK_MODEL, IMAGE_CHECK_SCHEMA, IMAGE_CHECK_PROMPT);
  args[args.indexOf("--tools") + 1] = "Read";
  const r = await runClaude(args, `Image file: ${basename(png)}\nExpected text: ${expected ? `«${expected}»` : "none (the card must show no text at all)"}${mood ? `\nMood of the note: ${mood}` : ""}`, { bin: opts.claudeBin, cwd: dirname(png), env: opts.env });
  if ("fail" in r) return { ok: false, reason: `check: ${r.fail}` };
  const e = readEnvelope(r.out, r.err, r.code, r.ms);
  if (!e.ok) return { ok: false, reason: `check: ${e.outcome.reason}`.slice(0, 200), limit: e.outcome.kind === "limit" };
  try {
    const v = readImageVerdict(e.output, expected);
    return v.ok ? { ok: true, textSeen: v.textSeen } : { ok: false, reason: `check: ${v.problems.join("; ")}`.slice(0, 200) };
  } catch (err) {
    return { ok: false, reason: String(err instanceof Error ? err.message : err).slice(0, 160) };
  }
}

/** One attempt: generate, post-produce, check. Never throws. */
export async function makeImage(job: { base: string; prompt: string; attempts: number; expected: string; mood?: string }, o: ImageGenOpts): Promise<ImageAttempt> {
  const t0 = Date.now();
  const rawDir = join(o.dir, "_raw");
  const rejDir = join(o.dir, "_rejected");
  mkdirSync(rawDir, { recursive: true });
  const raw = join(rawDir, `${job.base}-a${job.attempts + 1}.png`);
  // -r: a flat graphic card, not a photograph (without it the wrapper prepends «photorealistic»)
  const g = await run(o.gptimg, ["-r", job.prompt, raw], { cwd: rawDir, timeoutMs: GPTIMG_TIMEOUT_MS, env: o.env });
  if (g.timedOut) return { kind: "bad", reason: `gptimg timeout after ${g.ms} ms`, ms: Date.now() - t0 };
  let viaHf = false;
  if (g.code !== 0 && GPTIMG_LIMIT_RE.test(`${g.err} ${g.out}`)) {
    if (!o.hf) return { kind: "limit", reason: `gptimg: ${tail(g.err || g.out)}` };
    const b = reserveHf(o.dir, o.hf);
    if (!b) return { kind: "limit", reason: "higgsfield cap reached" }; // retried on a later run, not given up
    o.hf.log(`higgsfield: gptimg out of credits → gpt_image_2 1k low for ${job.base} · ~${HF_CREDITS_PER_IMAGE} credits · day ${b.dayCount}/${o.hf.dailyMax || "∞"} · total ${b.total}/${o.hf.totalMax || "∞"}`);
    const h = await run(o.hf.bin, ["generate", "create", "gpt_image_2", "--prompt", job.prompt, "--aspect_ratio", "16:9", "--resolution", "1k", "--quality", "low", "--wait", "--json"], { cwd: rawDir, timeoutMs: HF_TIMEOUT_MS, env: o.env });
    const url = h.code === 0 ? (h.out.match(/https:\/\/[^"\s]+?(?<!_min)\.png/) ?? [])[0] : undefined;
    if (!url && HF_UNAVAILABLE_RE.test(`${h.err} ${h.out}`)) return { kind: "limit", reason: `higgsfield unavailable: ${tail(h.err || h.out)}` };
    if (!url) return { kind: "bad", reason: `higgsfield exit ${h.code}${h.timedOut ? " (timeout)" : ""}: ${tail(h.err || h.out)}`, ms: Date.now() - t0, final: true };
    try {
      const r = await (o.hf.fetch ?? fetch)(url);
      if (!r.ok) throw new Error(`download ${r.status}`);
      writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      return { kind: "bad", reason: `higgsfield: ${e instanceof Error ? e.message : e}`, ms: Date.now() - t0, final: true };
    }
    viaHf = true;
  } else if (g.code !== 0 || !existsSync(raw)) return { kind: "bad", reason: `gptimg exit ${g.code}: ${tail(g.err)}`, ms: Date.now() - t0 };
  const files = await postProcess(raw, job.base, o.dir, o.cwebp);
  if ("error" in files) return { kind: "bad", reason: files.error, ms: Date.now() - t0, final: viaHf };
  const c = await checkImage(files.png, job.expected, o, job.mood);
  if (c.ok) {
    const sig = await imageSignature(files.png, rawDir);
    if (sig) return { kind: "ok", files, ms: Date.now() - t0, sig, textSeen: c.textSeen, final: viaHf };
  }
  if (!c.ok && c.limit && !viaHf) return { kind: "limit", reason: c.reason };
  const reason = c.ok ? "signature: sips failed" : c.reason;
  mkdirSync(rejDir, { recursive: true });
  for (const f of [files.png, files.webp]) if (existsSync(f)) renameSync(f, join(rejDir, basename(f).replace(/(\.\w+)$/, `-a${job.attempts + 1}$1`)));
  return { kind: "bad", reason, ms: Date.now() - t0, final: viaHf };
}

/**
 * Option A of #NEWSWATCH-2 (NOT approved, behind NEWS_WATCHER_IMAGE_PUBLISH=supabase):
 * the webp into a PUBLIC Storage bucket, same service role as the rows; returns its
 * public URL. The png master (~1.1 MB, 10× the webp) stays on the Mac: every browser
 * the site supports reads webp, and 30 days of png would be ~0.5 GB of Storage.
 */
export function storagePublisher(url: string, key: string, bucket: string, f: typeof fetch = fetch): (job: { base: string }, files: ImageFiles) => Promise<string> {
  const base = url.replace(/\/+$/, "");
  return async (job, files) => {
    const name = `${job.base}.webp`;
    const r = await f(`${base}/storage/v1/object/${bucket}/${name}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "image/webp", "x-upsert": "true", "cache-control": "max-age=31536000" },
      body: readFileSync(files.webp),
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) throw new Error(`storage ${name} → http ${r.status} ${(await r.text()).slice(0, 120)}`);
    return `${base}/storage/v1/object/public/${bucket}/${name}`;
  };
}

/** Retention: delete published cards by public URL (one call, at most 100 names); a URL outside the bucket is ignored. */
/** The approved neutral cards (no text) in the bucket: a note whose own card is refused or late goes out with one, never the stock picture. */
export const NEUTRAL_CARDS = ["news-00000000000a", "news-00000000000b", "news-00000000000c"]; // d (black boot on navy) refused at review 30/10
export const neutralCard = (url: string, bucket: string) => (hash: string): string =>
  `${url.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${NEUTRAL_CARDS[parseInt(hash.slice(0, 8), 16) % NEUTRAL_CARDS.length]}.webp`;

export function storageRemover(url: string, key: string, bucket: string, f: typeof fetch = fetch): (urls: string[]) => Promise<void> {
  const base = url.replace(/\/+$/, "");
  const prefix = `${base}/storage/v1/object/public/${bucket}/`;
  return async (urls) => {
    const names = urls.filter((u) => u.startsWith(prefix)).map((u) => u.slice(prefix.length)).filter((n) => /^news-[0-9a-f]{12}\.webp$/.test(n) && !NEUTRAL_CARDS.includes(n.slice(0, -5))).slice(0, 100); // the neutral set is shared, never retired
    if (!names.length) return;
    const r = await f(`${base}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: names }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`storage delete → http ${r.status} ${(await r.text()).slice(0, 120)}`);
  };
}
