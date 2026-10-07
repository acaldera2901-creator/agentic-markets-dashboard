// scripts/news_watcher/main.ts (#REDESIGN-V3C newswatch) — the news watcher, one run.
//
// launchd (com.betredge.news-watcher, every 600 s) runs a BUNDLED copy of this
// file that lives OUTSIDE ~/Desktop (TCC: a LaunchAgent cannot read ~/Desktop):
//   ~/Library/Application Support/news-watcher/news-watcher.mjs
// Install and switch-off: docs/redesign/news-watcher-proposal.md (gated).
//
//   node news-watcher.mjs              one run: read, rewrite, write to Supabase
//   node news-watcher.mjs --dry-run    same path, prints what it would write, writes NOTHING
//                                      (no DB call, the local state is not saved)
//   node news-watcher.mjs --limit 3    at most 3 rewrites this run
//   node news-watcher.mjs --unblock    clear a «blocked» stop after a person reviewed it
//
// Credentials: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from <home>/.env (chmod 600),
// read into this process only, never printed. No Anthropic key is used: the rewrite
// is the local `claude -p` on Andrea's subscription.
// Exit: 0 ok (also: disabled, usage limit, another run in progress) · 1 broken (DB,
// crash) · 2 the source blocked us (needs a person). `lab stato` shows ≠0 as ROTTO.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { rewriteWithClaude } from "../../lib/v3c/news/claude-cli";
import { freshState, runCycle, type StatePatch, type WatcherDb, type WatcherState } from "../../lib/v3c/news/watcher";
import type { NewsItemRow } from "../../lib/v3c/news/table";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const UNBLOCK = args.includes("--unblock");
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Math.max(0, Number(args[limitArg + 1]) || 0) : undefined;

const HOME = process.env.NEWS_WATCHER_HOME || join(homedir(), "Library", "Application Support", "news-watcher");
const STATE_FILE = join(HOME, "state.json");
const LOCK = join(HOME, "watcher.lock");
const HEARTBEAT = join(HOME, "last-run.json");
const CLAUDE_BIN = process.env.NEWS_WATCHER_CLAUDE || join(homedir(), ".local", "bin", "claude");

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

function loadState(): WatcherState {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as WatcherState;
    return s?.v === 1 ? s : freshState();
  } catch {
    return freshState();
  }
}

function saveState(s: WatcherState): void {
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(s), { mode: 0o600 });
  renameSync(tmp, STATE_FILE);
}

/** One run at a time: a run with many rewrites can outlast the 10-minute interval. */
function lock(): boolean {
  try {
    writeFileSync(LOCK, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    const pid = Number(readFileSync(LOCK, "utf8"));
    try {
      if (pid) process.kill(pid, 0);
      return false; // alive: the other run goes on
    } catch {
      writeFileSync(LOCK, String(process.pid)); // stale lock from a dead run
      return true;
    }
  }
}

/** PostgREST with the service role (same pattern as scripts/live_monitor.py). */
function restDb(url: string, key: string): WatcherDb {
  const base = `${url.replace(/\/+$/, "")}/rest/v1`;
  const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const call = async (method: string, path: string, body?: unknown, prefer?: string) => {
    const r = await fetch(`${base}${path}`, { method, headers: { ...h, ...(prefer ? { prefer } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} → http ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r;
  };
  return {
    async enabled() {
      const rows = (await (await call("GET", "/news_state?id=eq.1&select=enabled")).json()) as { enabled?: boolean }[];
      return rows[0]?.enabled === true;
    },
    async insert(rows: NewsItemRow[]) {
      await call("POST", "/news_items?on_conflict=guid_hash", rows, "resolution=ignore-duplicates,return=minimal");
    },
    async setState(patch: StatePatch) {
      await call("PATCH", "/news_state?id=eq.1", { ...patch, updated_at: new Date().toISOString() }, "return=minimal");
    },
    async prune(before: string) {
      await call("DELETE", `/news_items?published_at=lt.${encodeURIComponent(before)}`, undefined, "return=minimal");
    },
  };
}

/** --dry-run: the same calls, printed. Nothing leaves for the database. */
const dryDb: WatcherDb = {
  async enabled() {
    return true;
  },
  async insert(rows) {
    for (const r of rows) log(`[dry-run] WOULD INSERT news_items ${JSON.stringify(r)}`);
  },
  async setState(patch) {
    log(`[dry-run] WOULD UPDATE news_state ${JSON.stringify(patch)}`);
  },
  async prune(before) {
    log(`[dry-run] WOULD DELETE news_items published_at < ${before}`);
  },
};

async function main(): Promise<number> {
  mkdirSync(HOME, { recursive: true });
  const envFile = join(HOME, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const state = loadState();
  if (UNBLOCK) {
    log(`unblock: was ${state.blocked ?? "not blocked"}`);
    state.blocked = null;
    state.health = freshState().health;
    saveState(state);
    return 0;
  }
  let db = dryDb;
  if (!DRY) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      log(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in ${envFile}`);
      return 1;
    }
    db = restDb(url, key);
  }
  if (!DRY && !lock()) {
    log("previous run still in progress: skipping this one");
    return 0;
  }
  try {
    const rep = await runCycle(
      state,
      { now: Date.now, fetch, rewrite: (it) => rewriteWithClaude(it, { bin: CLAUDE_BIN, cwd: HOME }), db, log },
      { maxRewrites: LIMIT },
    );
    for (const { item, outcome } of rep.outcomes) {
      const u = "usage" in outcome && outcome.usage ? outcome.usage : null;
      const cost = u ? ` · ${u.ms} ms · in ${u.inTokens ?? "?"} / out ${u.outTokens ?? "?"} tok · list $${u.costUsd?.toFixed(4) ?? "?"} · ${u.model ?? "?"}` : "";
      if (outcome.kind === "ok") {
        const n = outcome.rewritten.note;
        log(`rewrite ok ${item.guid}${cost}`);
        if (DRY) {
          log(`  ORIGINAL (local only, never stored): ${item.title}`);
          log(`  EN: ${n.en.title} — ${n.en.body}`);
          log(`  IT: ${n.it.title} — ${n.it.body}`);
          log(`  teams: ${JSON.stringify(outcome.rewritten.teams)}`);
        }
      } else log(`rewrite ${outcome.kind} ${item.guid}: ${outcome.reason}${cost}`);
    }
    const summary = { at: new Date().toISOString(), dryRun: DRY, ...rep, outcomes: undefined };
    log(`run: exit ${rep.exit} · fetched page ${rep.fetched.page ?? "-"} rss ${rep.fetched.rss ?? "-"} · queued ${rep.queued} · rewritten ${rep.rewritten} · rejected ${rep.rejected.length} · written ${rep.written} · queue ${state.queue.length}${rep.limited ? " · LIMITED" : ""}${rep.errors.length ? ` · errors: ${rep.errors.join(" | ")}` : ""}`);
    if (!DRY) {
      saveState(state);
      writeFileSync(HEARTBEAT, JSON.stringify(summary, null, 2)); // the artifact daemon-health looks at
    }
    return rep.exit;
  } finally {
    if (!DRY) rmSync(LOCK, { force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    log(`crash: ${String(e).slice(0, 300)}`);
    process.exit(1);
  },
);
