// lib/v3c/news/claude-cli.ts (#REDESIGN-V3C newswatch) — the rewrite, by the
// local `claude -p` on Andrea's Mac (his subscription; no API key is read or
// passed — Andrea 07/10). Used only by the news watcher, never by the site.
//
// The call: headless print mode, the cheapest adequate model (haiku), no tools at
// all (`--tools ""`), safe mode (no CLAUDE.md, skills, hooks, plugins or MCP),
// no saved session, no thinking, JSON out validated against OUTPUT_SCHEMA (the
// CLI answers it in two turns, so no `--max-turns 1`). The item travels
// on stdin, the rules in the system prompt.
import { spawn } from "node:child_process";
import type { FeedItem } from "./feed";
import { OUTPUT_SCHEMA, PROMPT_VERSION, readModelOutput, RewriteError, SYSTEM_PROMPT, userPrompt, type Rewritten } from "./rewrite";

export const CLAUDE_MODEL = "haiku";
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

export function claudeArgs(model = CLAUDE_MODEL): string[] {
  return [
    "-p",
    "--safe-mode",
    "--model", model,
    "--tools", "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--output-format", "json",
    "--json-schema", JSON.stringify(OUTPUT_SCHEMA),
    "--system-prompt", SYSTEM_PROMPT,
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

/** Reads what `claude -p --output-format json` printed into an outcome. Pure. */
export function readCliOutput(stdout: string, stderr: string, code: number | null, item: FeedItem, ms: number): RewriteOutcome {
  let r: CliResult | null = null;
  try {
    r = JSON.parse(stdout.trim()) as CliResult;
  } catch {
    r = null;
  }
  const said = `${r?.result ?? ""} ${r ? "" : stdout} ${stderr}`.replace(/\s+/g, " ").trim().slice(0, 240);
  if (!r || r.is_error || code !== 0 || (r.subtype && r.subtype !== "success")) {
    if (LIMIT_RE.test(said)) return { kind: "limit", reason: said || "usage limit" };
    return { kind: "transient", reason: `claude exit ${code}${r?.subtype ? ` ${r.subtype}` : ""}: ${said || "no output"}` };
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
  try {
    const rewritten = readModelOutput(r.structured_output ?? r.result ?? "", item, `${model ?? CLAUDE_MODEL} · prompt ${PROMPT_VERSION}`);
    return { kind: "ok", rewritten, usage };
  } catch (e) {
    return { kind: "final", reason: e instanceof RewriteError ? e.message : String(e), usage };
  }
}

/** Runs the local `claude -p` once for one item. Never throws. */
export function rewriteWithClaude(item: FeedItem, opts: { bin: string; cwd: string; model?: string; env?: NodeJS.ProcessEnv }): Promise<RewriteOutcome> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    // the subscription login only: an API key in the environment would bill the API instead
    const env: NodeJS.ProcessEnv = { ...(opts.env ?? process.env), MAX_THINKING_TOKENS: "0" };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    let child;
    try {
      child = spawn(opts.bin, claudeArgs(opts.model), { cwd: opts.cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      resolve({ kind: "transient", reason: `spawn: ${String(e).slice(0, 120)}` });
      return;
    }
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e: Error) => {
      clearTimeout(timer);
      resolve({ kind: "transient", reason: `spawn: ${e.message.slice(0, 120)}` });
    });
    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer);
      if (signal) return resolve({ kind: "transient", reason: `claude killed (${signal}) after ${Date.now() - t0} ms` });
      resolve(readCliOutput(out, err, code, item, Date.now() - t0));
    });
    child.stdin.end(userPrompt(item));
  });
}
