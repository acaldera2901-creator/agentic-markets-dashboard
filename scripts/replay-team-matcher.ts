/**
 * #TEAM-MATCHER-1007 — read-only replay of the team-name matcher, OLD vs NEW,
 * over the prediction_log history of the snapshot ("summer") leagues.
 *
 * It does NOT touch the database: it reads two TSV exports produced by SELECTs
 * (see docs/hotfix-matcher-proposal.md §3 for the exact queries) and, for every
 * snapshot version that was live on main, rebuilds the model roster exactly as
 * app/api/predictions/route.ts does (`Object.keys(buildModel(history).strengths)`).
 *
 *   npx tsx scripts/replay-team-matcher.ts /tmp/matcher-replay
 *
 * Output: JSON summary on stdout + per-match detail in <dir>/affected.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildModel, predict, blendWithMarket, type PoissonModel } from "../lib/poisson-model";
import { applyTemperature } from "../lib/calibration";
import { matchModelTeam as matchNew } from "../lib/summer-leagues";

// ── OLD matcher, verbatim from origin/main @ 62804a41 ────────────────────────
const OLD_NOISE = new Set(["fc", "if", "ik", "bk", "afc", "sk", "fk", "ff", "aif", "cf", "sc", "club", "cd"]);
const STROKE_FOLD: Record<string, string> = {
  "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "th",
  "æ": "ae", "œ": "oe", "ß": "ss", "ı": "i", "ħ": "h", "ŋ": "n", "ŧ": "t",
};
function oldTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[łøđðþæœßıħŋŧ]/g, (c) => STROKE_FOLD[c])
    .replace(/[.'’]/g, "")
    .replace(/[/-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !OLD_NOISE.has(w));
}
function matchOld(sourceName: string, modelTeams: Iterable<string>): string | null {
  const src = oldTokens(sourceName).join(" ");
  if (!src) return null;
  let best: string | null = null;
  let bestScore = 0;
  let tied = false;
  for (const team of modelTeams) {
    const t = oldTokens(team).join(" ");
    if (!t) continue;
    if (t === src) return team;
    if (t.includes(src) || src.includes(t)) return team;
    const a = new Set(oldTokens(sourceName));
    const b = new Set(oldTokens(team));
    let overlap = 0;
    for (const w of a) if (b.has(w)) overlap += 1;
    const score = overlap / Math.max(a.size, b.size);
    if (score > bestScore) { bestScore = score; best = team; tied = false; }
    else if (score === bestScore && score > 0 && team !== best) tied = true;
  }
  if (tied) return null;
  return bestScore >= 0.6 ? best : null;
}

// ── Snapshot versions live on main (first-parent landing times) ──────────────
// Epochs (computed_at → snapshot commit) are assigned in the SELECT: cbd0cf01,
// 868ec9e5, 4d95705b, 37e53908, 114fe2f6, d1c07071, 3bec802f, 946ba7eb.
type Snap = { leagues: Record<string, { matches: Array<{ homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number }> }> };
const models = new Map<string, PoissonModel | null>();
const snaps = new Map<string, Snap>();
function modelFor(epoch: string, code: string): PoissonModel | null {
  const key = `${epoch}:${code}`;
  if (!models.has(key)) {
    if (!snaps.has(epoch)) {
      const raw = execFileSync("git", ["show", `${epoch}:data/summer_leagues/history.json`], { maxBuffer: 1 << 28 }).toString();
      snaps.set(epoch, JSON.parse(raw));
    }
    const league = snaps.get(epoch)!.leagues[code];
    models.set(key, league ? buildModel(league.matches.map((m) => ({ ...m }))) : null);
  }
  return models.get(key)!;
}

const dir = process.argv[2] ?? "/tmp/matcher-replay";
const tsv = (f: string) => readFileSync(join(dir, f), "utf8").trim().split("\n").map((l) => l.split("\t"));

// 1. Every (match, epoch) group of rows: does OLD differ from NEW on either side?
type Diff = { side: "home" | "away"; name: string; old: string | null; new: string | null };
function diffs(code: string, epoch: string, home: string, away: string): Diff[] {
  const m = modelFor(epoch, code);
  if (!m) return [];
  const roster = Object.keys(m.strengths);
  const out: Diff[] = [];
  for (const [side, name] of [["home", home], ["away", away]] as const) {
    const o = matchOld(name, roster);
    const n = matchNew(name, roster);
    if (o !== n) out.push({ side, name, old: o, new: n });
  }
  return out;
}

const rowsByMatch = new Map<string, { league: string; home: string; away: string; kickoff: string; rows: number; badRows: number; diffs: Diff[] }>();
for (const [matchId, league, home, away, kickoff, epoch, n] of tsv("pl_epochs.tsv")) {
  const d = diffs(league, epoch, home, away);
  const e = rowsByMatch.get(matchId) ?? { league, home, away, kickoff, rows: 0, badRows: 0, diffs: [] };
  e.rows += Number(n);
  if (d.length) {
    e.badRows += Number(n);
    for (const x of d) if (!e.diffs.some((y) => y.name === x.name && y.old === x.old)) e.diffs.push(x);
  }
  rowsByMatch.set(matchId, e);
}

// 2. Last pre-kickoff row per match: recompute with the NEW matcher, same market.
const brier = (p: number[], r: string) => {
  const y = r === "home" ? [1, 0, 0] : r === "draw" ? [0, 1, 0] : [0, 0, 1];
  return p.reduce((s, v, i) => s + (v - y[i]) ** 2, 0);
};
const pickOf = (p: number[]) => ["home", "draw", "away"][p.indexOf(Math.max(...p))];
const affected: unknown[] = [];
let bOldSub = 0, hitOldSub = 0, bMktSub = 0;
let nSettled = 0, bOld = 0, bNew = 0, bMkt = 0, dropped = 0, pickFlips = 0, hitOld = 0, hitNew = 0;
const now = Date.now();
const reproErr: number[] = [];
const future: unknown[] = [];
for (const r of tsv("pl_last.tsv")) {
  const [matchId, league, home, away, kickoff, epoch] = r;
  const served = r.slice(7, 10).map(Number);
  const market = r.slice(13, 16).map((x) => (x === "" ? NaN : Number(x)));
  const result = r[16];
  const d = diffs(league, epoch, home, away);
  if (!d.length) continue;
  const m = modelFor(epoch, league)!;
  const roster = Object.keys(m.strengths);
  const mk = market.every(Number.isFinite) ? { home: market[0], draw: market[1], away: market[2] } : null;
  const serve = (h: string | null, a: string | null): number[] | null => {
    if (!h || !a) return null;
    const p = predict(h, a, m);
    if (!p) return null;
    const s = blendWithMarket(applyTemperature({ pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway }), mk);
    return [s.pHome, s.pDraw, s.pAway];
  };
  const recomputed = serve(matchNew(home, roster), matchNew(away, roster));
  // Method check: the OLD matcher on the same snapshot must reproduce what was stored.
  const reproduced = serve(matchOld(home, roster), matchOld(away, roster));
  if (reproduced) reproErr.push(Math.max(...reproduced.map((v, i) => Math.abs(v - served[i]))));
  const row = { matchId, league, home, away, kickoff, epoch, diffs: d, served, market, recomputed, result };
  affected.push(row);
  if (Date.parse(kickoff) > now) future.push(row);
  if (result && ["home", "draw", "away"].includes(result) && market.every(Number.isFinite)) {
    nSettled += 1;
    bOld += brier(served, result);
    bMkt += brier(market, result);
    if (recomputed) { bNew += brier(recomputed, result); bOldSub += brier(served, result); bMktSub += brier(market, result); if (pickOf(served) === result) hitOldSub += 1; }
    else dropped += 1;
    if (pickOf(served) === result) hitOld += 1;
    if (recomputed && pickOf(recomputed) === result) hitNew += 1;
    if (recomputed && pickOf(recomputed) !== pickOf(served)) pickFlips += 1;
  }
}

const bad = [...rowsByMatch.entries()].filter(([, e]) => e.badRows > 0);
const byLeague: Record<string, { matches: number; rows: number }> = {};
for (const [, e] of bad) {
  byLeague[e.league] ??= { matches: 0, rows: 0 };
  byLeague[e.league].matches += 1;
  byLeague[e.league].rows += e.badRows;
}
const pairs = new Map<string, number>();
for (const [, e] of bad) for (const x of e.diffs) {
  const k = `${e.league}: "${x.name}" old→${x.old} new→${x.new}`;
  pairs.set(k, (pairs.get(k) ?? 0) + 1);
}
// 3. Sealed register (pick_ledger ⨝ pick_settlement_current), epoch = captured_at.
const ledger: Array<Record<string, unknown>> = [];
let ledgerBrierOld = 0, ledgerN = 0;
const ledgerFile = join(dir, "ledger.tsv");
if (existsSync(ledgerFile)) {
  for (const r of tsv("ledger.tsv")) {
    const [id, sourceId, league, home, away, epoch, pick, ph, pd, pa, odds, commence, result, outcome, reason, isPaper, signal] = r;
    const d = diffs(league, epoch, home, away);
    if (!d.length) continue;
    ledger.push({ id, sourceId, league, home, away, epoch, pick, p: [ph, pd, pa].map((x) => Math.round(Number(x) * 1000) / 1000), odds, commence, result, outcome, reason, isPaper, signal, diffs: d });
    if (outcome) { ledgerN += 1; ledgerBrierOld += brier([ph, pd, pa].map(Number), outcome.toLowerCase()); }
  }
}
writeFileSync(join(dir, "ledger_affected.json"), JSON.stringify(ledger, null, 1));
writeFileSync(join(dir, "affected.json"), JSON.stringify({ affected, future }, null, 1));
console.log(JSON.stringify({
  prediction_log_rows_total: [...rowsByMatch.values()].reduce((s, e) => s + e.rows, 0),
  matches_total: rowsByMatch.size,
  matches_affected: bad.length,
  rows_affected: bad.reduce((s, [, e]) => s + e.badRows, 0),
  byLeague,
  name_pairs: Object.fromEntries([...pairs.entries()].sort((a, b) => b[1] - a[1])),
  settled_last_prekickoff: {
    n: nSettled, dropped_by_new_matcher: dropped,
    brier_served_old: nSettled ? bOld / nSettled : null,
    brier_recomputed_new: nSettled - dropped ? bNew / (nSettled - dropped) : null,
    brier_market: nSettled ? bMkt / nSettled : null,
    same_subset_recomputable: { n: nSettled - dropped, brier_old: bOldSub / (nSettled - dropped), brier_new: bNew / (nSettled - dropped), brier_market: bMktSub / (nSettled - dropped), hits_old: hitOldSub, hits_new: hitNew },
    argmax_hits_old: hitOld, argmax_hits_new: hitNew, argmax_flips: pickFlips,
  },
  future: future.length,
  ledger_affected: { rows: ledger.length, with_outcome: ledgerN, brier_sealed_on_those: ledgerN ? ledgerBrierOld / ledgerN : null, by_result: ledger.reduce<Record<string, number>>((acc, l) => { const k = `${l.result || 'open'}${l.pick ? '' : '(no pick)'}`; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}) },
  method_check_old_reproduces_stored: { n: reproErr.length, within_0_005: reproErr.filter((e) => e < 0.005).length, max_abs_err: Math.max(...reproErr) },
}, null, 1));
