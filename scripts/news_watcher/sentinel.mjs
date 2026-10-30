// scripts/news_watcher/sentinel.mjs (#NEWSWATCH-2) — is the news loop alive?
// Run by launchd (com.betredge.news-sentinel, every 300 s) from a copy OUTSIDE
// ~/Desktop (TCC), next to the watcher. Reads ONLY the watcher's heartbeat
// (last-run.json): no network, no database, no secret.
//
//  - no run that READ the source for more than NEWS_SENTINEL_MAX_MIN (15) minutes
//    → one macOS notification per stall, a line on stdout, exit 3. `lab stato`
//    discovers every plist by itself: exit ≠ 0 shows as «ROTTO (exit 3)» with that
//    line as the reason — the «riga in lab stato» without touching lab-stato.
//  - loop back → one line «rientrato», exit 0. Healthy → silent, exit 0.
//  - the switch off in news_state (the watcher reports `disabled`) is not a stall.
//
//   node sentinel.mjs            check now
//   node sentinel.mjs --dry-run  check, print, never notify, never write the marker
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const HOME = process.env.NEWS_WATCHER_HOME || join(homedir(), "Library", "Application Support", "news-watcher");
const HEARTBEAT = join(HOME, "last-run.json");
const MARK = join(HOME, "sentinel.stalled");
const MAX_MIN = Number(process.env.NEWS_SENTINEL_MAX_MIN) || 15;
const DRY = process.argv.includes("--dry-run");
const now = Date.now();
const hhmm = (t) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

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
    console.log(`${new Date(now).toISOString()} news-watcher rientrato: ultimo giro riuscito alle ${hhmm(lastOk)}`);
    if (!DRY) rmSync(MARK, { force: true });
  }
  process.exit(0);
}

const why = hb ? (hb.exit === 2 ? "FotMob ci ha bloccati (exit 2, serve --unblock)" : hb.errors?.length ? hb.errors.join(" | ").slice(0, 120) : `ultimo giro alle ${hhmm(Date.parse(hb.at))}`) : "nessun last-run.json";
const line = `news-watcher fermo: nessun giro riuscito da ${ageMin ?? "?"} min${Number.isFinite(lastOk) ? ` (ultimo alle ${hhmm(lastOk)})` : ""} · ${why}`;
console.log(`${new Date(now).toISOString()} ${line}`);
const already = existsSync(MARK) && readFileSync(MARK, "utf8") === String(okIso);
if (!already && !DRY) {
  try {
    execFileSync("/usr/bin/osascript", ["-e", `display notification ${JSON.stringify(line)} with title "BetRedge News" sound name "Basso"`]);
  } catch {
    /* no GUI session: the log line and the exit code still tell */
  }
  writeFileSync(MARK, String(okIso));
}
process.exit(3);
