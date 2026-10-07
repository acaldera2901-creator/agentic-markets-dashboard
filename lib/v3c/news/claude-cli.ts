// lib/v3c/news/claude-cli.ts (#REDESIGN-V3C newswatch) — the rewrite, by the
// local `claude -p` on Andrea's Mac (his subscription; no API key is read or
// passed — Andrea 07/10). Used only by the news watcher, never by the site.
//
// The call: headless print mode, the cheapest adequate model (haiku), no tools at
// all (`--tools ""`), safe mode (no CLAUDE.md, skills, hooks, plugins or MCP),
// no saved session, no thinking, JSON out validated against OUTPUT_SCHEMA (the
// CLI answers it in two turns, so no `--max-turns 1`). The item travels
// on stdin, the rules in the system prompt.
//
// Two calls per item: the rewrite, then — only if the note passed the mechanical
// checks — the second reading (verify.ts), same mode, its own prompt and schema.
// One unsupported claim → the note is dropped («final»), never written.
import { spawn } from "node:child_process";
import type { FeedItem } from "./feed";
import { OUTPUT_SCHEMA, PROMPT_VERSION, readModelOutput, RewriteError, SYSTEM_PROMPT, userPrompt, type Rewritten } from "./rewrite";
import { readVerdict, VERIFY_PROMPT, VERIFY_SCHEMA, verifyPrompt } from "./verify";

export const CLAUDE_MODEL = "haiku";
/**
 * The second reading needs the stronger model: measured 07/10 on the 5 notes the
 * watcher had written, haiku as verifier missed «Ellis scored the goal» 3 runs of 3
 * and flipped on Kane's record; sonnet flagged Ellis, Kane and «match in Buenos
 * Aires» 2 runs of 2, and passed the faithful ones. ~5 s, ~$0.002–0.01 list per call
 * (subscription), only for notes that already passed the mechanical checks.
 */
export const VERIFY_MODEL = "sonnet";
const TIMEOUT_MS = 120_000;

/** What one rewrite attempt ended in. Only `ok` produces a row. */
export type RewriteOutcome =
  | { kind: "ok"; rewritten: Rewritten; usage: CallUsage }
  /** the model said no, or the text failed a check: dropped for good */
  | { kind: "final"; reason: string; usage?: CallUsage }
  /** subscription usage/rate limit: stop for this run, the item stays queued */
  | { kind: "limit"; reason: string }
  /** anything else (timeout, crash, unreadable answer): retried on a later run */
  | { kind: "transient"; reason: string };

export type CallUsage = { ms: number; costUsd: number | null; inTokens: number | null; outTokens: number | null; model: string | null };

export function claudeArgs(model = CLAUDE_MODEL, schema: object = OUTPUT_SCHEMA, system: string = SYSTEM_PROMPT): string[] {
  return [
    "-p",
    "--safe-mode",
    "--model", model,
    "--tools", "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--output-format", "json",
    "--json-schema", JSON.stringify(schema),
    "--system-prompt", system,
    // measured 07/10 on a real item: with thinking on, haiku spent 3,654 thinking
    // tokens and 37 s on a 60-word note; off, 0 tokens and 4 s, same quality
    "--settings", JSON.stringify({ alwaysThinkingEnabled: false }),
  ];
}

/** «You've hit your weekly limit», 429, usage/rate/quota limit, overloaded. */
export const LIMIT_RE = /hit your (?:weekly |daily |session )?limit|usage limit|rate.?limit|quota|\b429\b|overloaded|limit (?:will )?reset|resets? at/i;

type CliResult = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  modelUsage?: Record<string, unknown>;
};

type Envelope = { ok: true; output: unknown; usage: CallUsage } | { ok: false; outcome: Extract<RewriteOutcome, { kind: "limit" | "transient" }> };

/** What `claude -p --output-format json` printed → the model's output and the usage, or why not. Pure. */
function readEnvelope(stdout: string, stderr: string, code: number | null, ms: number): Envelope {
  let r: CliResult | null = null;
  try {
    r = JSON.parse(stdout.trim()) as CliResult;
  } catch {
    r = null;
  }
  const said = `${r?.result ?? ""} ${r ? "" : stdout} ${stderr}`.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!r || r.is_error || code !== 0 || (r.subtype && r.subtype !== "success")) {
    if (LIMIT_RE.test(said)) return { ok: false, outcome: { kind: "limit", reason: said || "usage limit" } };
    return { ok: false, outcome: { kind: "transient", reason: `claude exit ${code}${r?.subtype ? ` ${r.subtype}` : ""}: ${said || "no output"}` } };
  }
  const model = r.modelUsage ? Object.keys(r.modelUsage)[0] ?? null : null;
  const u = r.usage ?? {};
  const usage: CallUsage = {
    ms,
    costUsd: typeof r.total_cost_usd === "number" ? r.total_cost_usd : null,
    inTokens: typeof u.input_tokens === "number" ? u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : null,
    outTokens: typeof u.output_tokens === "number" ? u.output_tokens : null,
    model,
  };
  return { ok: true, output: r.structured_output ?? r.result ?? "", usage };
}

/** Reads what the REWRITE call printed into an outcome. Pure. */
export function readCliOutput(stdout: string, stderr: string, code: number | null, item: FeedItem, ms: number): RewriteOutcome {
  const e = readEnvelope(stdout, stderr, code, ms);
  if (!e.ok) return e.outcome;
  try {
    const rewritten = readModelOutput(e.output, item, `${e.usage.model ?? CLAUDE_MODEL} · prompt ${PROMPT_VERSION}`);
    return { kind: "ok", rewritten, usage: e.usage };
  } catch (err) {
    return { kind: "final", reason: err instanceof RewriteError ? err.message : String(err), usage: e.usage };
  }
}

/** Reads what the VERIFY call printed, for a rewrite that was ok: still ok, or dropped. Pure. */
export function readVerifyOutput(stdout: string, stderr: string, code: number | null, ms: number, rewrite: Extract<RewriteOutcome, { kind: "ok" }>): RewriteOutcome {
  const e = readEnvelope(stdout, stderr, code, ms);
  if (!e.ok) return e.outcome.kind === "limit" ? e.outcome : { kind: "transient", reason: `verify: ${e.outcome.reason}` };
  const usage = sumUsage(rewrite.usage, e.usage);
  let v;
  try {
    v = readVerdict(e.output);
  } catch (err) {
    return { kind: "transient", reason: String(err instanceof Error ? err.message : err).slice(0, 160) };
  }
  if (!v.supported) return { kind: "final", reason: `verifier: ${v.unsupported.join("; ")}`.slice(0, 300), usage };
  const note = { ...rewrite.rewritten.note, model: `${rewrite.rewritten.note.model} · verified ${e.usage.model ?? VERIFY_MODEL}` };
  return { kind: "ok", rewritten: { ...rewrite.rewritten, note }, usage };
}

const add = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
const sumUsage = (a: CallUsage, b: CallUsage): CallUsage => ({ ms: a.ms + b.ms, costUsd: add(a.costUsd, b.costUsd), inTokens: add(a.inTokens, b.inTokens), outTokens: add(a.outTokens, b.outTokens), model: a.model ?? b.model });

type Run = { out: string; err: string; code: number | null; ms: number } | { fail: string };

/** One `claude -p` process: args, stdin in, stdout/stderr out. Never throws. */
function runClaude(args: string[], stdin: string, opts: { bin: string; cwd: string; env?: NodeJS.ProcessEnv }): Promise<Run> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    // the subscription login only: an API key in the environment would bill the API instead
    const env: NodeJS.ProcessEnv = { ...(opts.env ?? process.env), MAX_THINKING_TOKENS: "0" };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    let child;
    try {
      child = spawn(opts.bin, args, { cwd: opts.cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      resolve({ fail: `spawn: ${String(e).slice(0, 120)}` });
      return;
    }
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e: Error) => {
      clearTimeout(timer);
      resolve({ fail: `spawn: ${e.message.slice(0, 120)}` });
    });
    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      if (signal) return resolve({ fail: `claude killed (${signal}) after ${Date.now() - t0} ms` });
      resolve({ out, err, code, ms: Date.now() - t0 });
    });
    child.stdin.end(stdin);
  });
}

/** The second reading alone, for a note already written (re-verification). Never throws. */
export async function verifyWithClaude(item: Pick<FeedItem, "title" | "text"> & { body?: string }, note: Rewritten["note"], opts: { bin: string; cwd: string; verifyModel?: string; env?: NodeJS.ProcessEnv }): Promise<RewriteOutcome> {
  const fake: Extract<RewriteOutcome, { kind: "ok" }> = { kind: "ok", rewritten: { note, teams: [] }, usage: { ms: 0, costUsd: null, inTokens: null, outTokens: null, model: null } };
  const r = await runClaude(claudeArgs(opts.verifyModel ?? VERIFY_MODEL, VERIFY_SCHEMA, VERIFY_PROMPT), verifyPrompt(item, note), opts);
  if ("fail" in r) return { kind: "transient", reason: `verify: ${r.fail}` };
  return readVerifyOutput(r.out, r.err, r.code, r.ms, fake);
}

/** Rewrite, mechanical checks, second reading: one item, two `claude -p` calls at most. Never throws. */
export async function rewriteWithClaude(item: FeedItem, opts: { bin: string; cwd: string; model?: string; verifyModel?: string; env?: NodeJS.ProcessEnv }): Promise<RewriteOutcome> {
  const r = await runClaude(claudeArgs(opts.model), userPrompt(item), opts);
  if ("fail" in r) return { kind: "transient", reason: r.fail };
  const first = readCliOutput(r.out, r.err, r.code, item, r.ms);
  if (first.kind !== "ok") return first; // the mechanical checks already said no: no second call spent
  const v = await runClaude(claudeArgs(opts.verifyModel ?? VERIFY_MODEL, VERIFY_SCHEMA, VERIFY_PROMPT), verifyPrompt(item, first.rewritten.note), opts);
  if ("fail" in v) return { kind: "transient", reason: `verify: ${v.fail}` };
  return readVerifyOutput(v.out, v.err, v.code, v.ms, first);
}
