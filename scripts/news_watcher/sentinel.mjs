// scripts/news_watcher/sentinel.mjs (#NEWSWATCH-2, #NEWSWATCH-AUTO) — is the news loop alive and healthy?
// Run by launchd (com.betredge.news-sentinel, every 300 s) from a copy OUTSIDE
// ~/Desktop (TCC), next to the watcher. Reads the watcher's heartbeat
// (last-run.json) and the new lines of watcher.log; no database.
//
//  - no run that READ the source for more than NEWS_SENTINEL_MAX_MIN (30) minutes
//    → alert once per stall, a line on stdout, exit 3. `lab stato` discovers every
//    plist by itself: exit ≠ 0 shows as «ROTTO (exit 3)» with that line as the reason.
//  - degraded (from the new lines of watcher.log): ≥ 3 runs in a row with errors,
//    Higgsfield not authenticated / out of credits, Codex AND Higgsfield both failed,
//    notes waiting without a picture because of a limit → alert, at most once per
//    key every NEWS_SENTINEL_REPEAT_H (6) hours. Exit stays 0 (the loop runs).
//  - loop back → one line «rientrato», exit 0. Healthy → silent, exit 0.
//  - the switch off in news_state (the watcher reports `disabled`) is not a stall.
//  - housekeeping: watcher.log / sentinel.log over 5 MB are cut to their last 1 MB.
//
// Alert channels: macOS notification + Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID,
// read from NEWS_SENTINEL_TG_ENV, default ~/Desktop/agentic-markets/.env, then <home>/.env).
//
//   node sentinel.mjs            check now
//   node sentinel.mjs --dry-run  check, print, never notify, never write the marker
//   node sentinel.mjs --test     send one test alert on every channel and exit
import { closeSync, existsSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const HOME = process.env.NEWS_WATCHER_HOME || join(homedir(), "Library", "Application Support", "news-watcher");
const HEARTBEAT = join(HOME, "last-run.json");
const LOG = join(HOME, "watcher.log");
const MARK = join(HOME, "sentinel.stalled");
const SEEN = join(HOME, "sentinel-state.json");
const MAX_MIN = Number(process.env.NEWS_SENTINEL_MAX_MIN) || 30;
const REPEAT_MS = (Number(process.env.NEWS_SENTINEL_REPEAT_H) || 6) * 3_600_000;
const LOG_MAX = 5 * 1024 * 1024;
const LOG_KEEP = 1024 * 1024;
const DRY = process.argv.includes("--dry-run");
const now = Date.now();
const stamp = () => new Date().toISOString();
const hhmm = (t) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

function envFrom(file) {
  const out = {};
  try {
    for (const l of readFileSync(file, "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* unreadable (TCC or missing): next file */
  }
  return out;
}

function telegramCreds() {
  for (const f of [process.env.NEWS_SENTINEL_TG_ENV || join(homedir(), "Desktop", "agentic-markets", ".env"), join(HOME, ".env")]) {
    const e = envFrom(f);
    if (e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID) return e;
  }
  return null;
}

/** Every channel, best effort; returns the channels that took it (logged, so a dead channel shows). */
async function alert(text) {
  const used = [];
  try {
    execFileSync("/usr/bin/osascript", ["-e", `display notification ${JSON.stringify(text)} with title "BetRedge News" sound name "Basso"`]);
    used.push("macos");
  } catch {
    /* no GUI session */
  }
  const tg = telegramCreds();
  if (!tg) used.push("telegram:no-creds");
  else {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tg.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: tg.TELEGRAM_CHAT_ID, text: `BetRedge News · ${text}` }),
        signal: AbortSignal.timeout(15_000),
      });
      used.push(r.ok ? "telegram" : `telegram:http-${r.status}`);
    } catch (e) {
      used.push(`telegram:${String(e?.message ?? e).slice(0, 40)}`);
    }
  }
  console.log(`${stamp()} alert [${used.join(",")}] ${text}`);
  return used;
}

/** Cut a log over LOG_MAX to its last LOG_KEEP bytes, in place (launchd keeps appending to the same file). */
function trim(file) {
  try {
    const size = statSync(file).size;
    if (size <= LOG_MAX) return false;
    const fd = openSync(file, "r");
    const buf = Buffer.alloc(LOG_KEEP);
    readSync(fd, buf, 0, LOG_KEEP, size - LOG_KEEP);
    closeSync(fd);
    const text = buf.toString("utf8");
    writeFileSync(file, `${stamp()} [sentinel] log cut from ${size} bytes\n${text.slice(text.indexOf("\n") + 1)}`);
    return true;
  } catch {
    return false; // missing: nothing to cut
  }
}

let seen = { offset: 0, sent: {}, errRuns: 0 };
try {
  seen = { ...seen, ...JSON.parse(readFileSync(SEEN, "utf8")) };
} catch {
  /* first run */
}

if (process.argv.includes("--test")) {
  const used = await alert(`notifica di prova della sentinella (${hhmm(now)}) — nessun guasto`);
  process.exit(used.includes("telegram") ? 0 : 4);
}

// --- degraded: the watcher.log lines written since the last check
const problems = [];
try {
  const size = statSync(LOG).size;
  const from = size < seen.offset ? 0 : seen.offset; // the log was cut: read it again from the start
  const len = Math.min(size - from, 2 * 1024 * 1024);
  const fd = openSync(LOG, "r");
  const buf = Buffer.alloc(len);
  readSync(fd, buf, 0, len, size - len);
  closeSync(fd);
  const text = buf.toString("utf8");
  for (const l of text.split("\n")) {
    if (/ run: exit /.test(l)) seen.errRuns = / · errors: /.test(l) || / run: exit [^0]/.test(l) ? seen.errRuns + 1 : 0;
  }
  if (seen.errRuns >= 3) problems.push(["errors", `${seen.errRuns} giri di fila con errori`]);
  if (/higgsfield unavailable: .*(?:unauthori|authenticat|log ?in|expired|401|403)/i.test(text)) problems.push(["hf-auth", "Higgsfield non autenticato / token scaduto: serve `higgsfield auth login`"]);
  else if (/higgsfield unavailable|higgsfield cap reached/i.test(text)) problems.push(["hf-credits", "Higgsfield senza crediti o limitato"]);
  if (/image refused .*higgsfield/i.test(text)) problems.push(["both-failed", "Codex senza crediti e Higgsfield fallito: nota con l'immagine di tipo"]);
  if (/image: usage limit/.test(text)) {
    const pend = [...text.matchAll(/ pending (\d+)/g)].at(-1)?.[1];
    if (Number(pend) > 0) problems.push(["pending-limit", `${pend} note senza immagine in attesa di crediti (riprovate da sole al prossimo giro)`]);
  }
  seen.offset = size;
} catch {
  /* no log yet */
}
for (const [key, msg] of problems) {
  if (now - (seen.sent[key] ?? 0) < REPEAT_MS) continue;
  if (DRY) {
    console.log(`${stamp()} [dry-run] degradato: ${msg}`);
    continue;
  }
  await alert(`degradato: ${msg}`);
  seen.sent[key] = now;
}
if (!DRY) {
  if (trim(LOG)) seen.offset = statSync(LOG).size;
  trim(join(HOME, "sentinel.log"));
  writeFileSync(SEEN, JSON.stringify(seen));
}

// --- stalled: no run that read the source for MAX_MIN
let hb = null;
try {
  hb = JSON.parse(readFileSync(HEARTBEAT, "utf8"));
} catch {
  hb = null;
}
// lastOkAt since #NEWSWATCH-2; an older heartbeat counts if that run read the page or the RSS
const okIso = hb?.lastOkAt ?? (hb && (hb.fetched?.page != null || hb.fetched?.rss != null) ? hb.at : null);
const lastOk = okIso ? Date.parse(okIso) : NaN;
const ageMin = Number.isFinite(lastOk) ? Math.round((now - lastOk) / 60_000) : null;

if (hb?.disabled) {
  process.exit(0); // switched off on purpose in news_state
}
if (ageMin != null && ageMin <= MAX_MIN) {
  if (existsSync(MARK)) {
    console.log(`${stamp()} news-watcher rientrato: ultimo giro riuscito alle ${hhmm(lastOk)}`);
    if (!DRY) rmSync(MARK, { force: true });
  }
  process.exit(0);
}

const why = hb ? (hb.exit === 2 ? "FotMob ci ha bloccati (exit 2, serve --unblock)" : hb.errors?.length ? hb.errors.join(" | ").slice(0, 120) : `ultimo giro alle ${hhmm(Date.parse(hb.at))}`) : "nessun last-run.json";
const line = `news-watcher fermo: nessun giro riuscito da ${ageMin ?? "?"} min${Number.isFinite(lastOk) ? ` (ultimo alle ${hhmm(lastOk)})` : ""} · ${why}`;
console.log(`${stamp()} ${line}`);
const already = existsSync(MARK) && readFileSync(MARK, "utf8") === String(okIso);
if (!already && !DRY) {
  await alert(line);
  writeFileSync(MARK, String(okIso));
}
process.exit(3);
