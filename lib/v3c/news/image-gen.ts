// lib/v3c/news/image-gen.ts (#NEWSWATCH-2) — one attempt at the picture of one
// note, on Andrea's Mac: `gptimg` (Codex, subscription, $0), then the
// post-production of art direction (centre crop 16:9 → 1200×675 png, webp
// < 150 KB), then the visual check by `claude -p` (sonnet, Read only). Used only
// by the news watcher, behind NEWS_WATCHER_IMAGES (off by default).
//
//  - `gptimg` strictly in SERIES (two at once steal each other's PNG — known bug
//    of the wrapper) and with stdin closed (= `</dev/null`: otherwise `codex exec`
//    waits on stdin forever when started by a script or a daemon).
//  - Post-production with macOS `sips` + `cwebp`: no Python, no npm dependency.
//  - A picture the check refuses is moved to _rejected/ (kept as evidence), never served.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { claudeArgs, readEnvelope, runClaude } from "./claude-cli";
import { IMAGE_CHECK_PROMPT, IMAGE_CHECK_SCHEMA, IMAGE_SIZE, MAX_WEBP_BYTES, readImageVerdict } from "./image";

/** gptimg measured 42–77 s (6 calls, 29/10); beyond this the attempt is lost. */
export const GPTIMG_TIMEOUT_MS = 240_000;
export const IMAGE_CHECK_MODEL = "sonnet";

export type ImageFiles = { png: string; webp: string; webpBytes: number };
export type ImageAttempt =
  | { kind: "ok"; files: ImageFiles; ms: number }
  /** this attempt failed (generation, post-production or the visual check): counts towards the cap */
  | { kind: "bad"; reason: string; ms: number }
  /** the subscription said stop (checker): no attempt counted, images wait for a later run */
  | { kind: "limit"; reason: string };

export type ImageGenOpts = { dir: string; gptimg: string; cwebp: string; claudeBin: string; checkModel?: string; env?: NodeJS.ProcessEnv };

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

/** The visual check on the finished png: `claude -p` with the Read tool only, in the image's folder. */
export async function checkImage(png: string, opts: Pick<ImageGenOpts, "claudeBin" | "checkModel" | "env">): Promise<{ ok: true } | { ok: false; reason: string; limit?: boolean }> {
  const args = claudeArgs(opts.checkModel ?? IMAGE_CHECK_MODEL, IMAGE_CHECK_SCHEMA, IMAGE_CHECK_PROMPT);
  args[args.indexOf("--tools") + 1] = "Read";
  const r = await runClaude(args, `Image file: ${basename(png)}`, { bin: opts.claudeBin, cwd: dirname(png), env: opts.env });
  if ("fail" in r) return { ok: false, reason: `check: ${r.fail}` };
  const e = readEnvelope(r.out, r.err, r.code, r.ms);
  if (!e.ok) return { ok: false, reason: `check: ${e.outcome.reason}`.slice(0, 200), limit: e.outcome.kind === "limit" };
  try {
    const v = readImageVerdict(e.output);
    return v.ok ? { ok: true } : { ok: false, reason: `check: ${v.problems.join("; ")}`.slice(0, 200) };
  } catch (err) {
    return { ok: false, reason: String(err instanceof Error ? err.message : err).slice(0, 160) };
  }
}

/** One attempt: generate, post-produce, check. Never throws. */
export async function makeImage(job: { base: string; prompt: string; attempts: number }, o: ImageGenOpts): Promise<ImageAttempt> {
  const t0 = Date.now();
  const rawDir = join(o.dir, "_raw");
  const rejDir = join(o.dir, "_rejected");
  mkdirSync(rawDir, { recursive: true });
  const raw = join(rawDir, `${job.base}-a${job.attempts + 1}.png`);
  const g = await run(o.gptimg, [job.prompt, raw], { cwd: rawDir, timeoutMs: GPTIMG_TIMEOUT_MS, env: o.env });
  if (g.timedOut) return { kind: "bad", reason: `gptimg timeout after ${g.ms} ms`, ms: Date.now() - t0 };
  if (g.code !== 0 || !existsSync(raw)) return { kind: "bad", reason: `gptimg exit ${g.code}: ${tail(g.err)}`, ms: Date.now() - t0 };
  const files = await postProcess(raw, job.base, o.dir, o.cwebp);
  if ("error" in files) return { kind: "bad", reason: files.error, ms: Date.now() - t0 };
  const c = await checkImage(files.png, o);
  if (c.ok) return { kind: "ok", files, ms: Date.now() - t0 };
  if (!c.ok && c.limit) return { kind: "limit", reason: c.reason };
  mkdirSync(rejDir, { recursive: true });
  for (const f of [files.png, files.webp]) if (existsSync(f)) renameSync(f, join(rejDir, basename(f).replace(/(\.\w+)$/, `-a${job.attempts + 1}$1`)));
  return { kind: "bad", reason: c.reason, ms: Date.now() - t0 };
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
