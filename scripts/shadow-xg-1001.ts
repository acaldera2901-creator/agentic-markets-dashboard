/**
 * #XG-1001 shadow comparison — read-only, no DB, no API-Football quota.
 * xG-on vs xG-off on the CURRENT season's played matches, on the served code
 * path (buildModel/predict + applyTemperature), mirroring production:
 *   - goals model trained on the prior 365 days (lib/football-data fetchHistory);
 *   - team xG = last <=10 home/away matches of the current Understat season
 *     (lib/understat parseUnderstatTeams shape), only matches before kickoff;
 *   - market blend NOT applied (no historical closing odds here).
 * Data: understat.com/getLeagueData (same endpoint as lib/understat.ts).
 *
 * Run: npx tsx scripts/shadow-xg-1001.ts
 */
import { buildModel, predict, type MatchResult } from "../lib/poisson-model";
import { applyTemperature } from "../lib/calibration";
import { understatSeason } from "../lib/understat";

const LEAGUES: Record<string, string> = { SA: "Serie_A", PL: "EPL", PD: "La_liga", BL1: "Bundesliga", FL1: "Ligue_1" };

type Row = { date: string; home: string; away: string; hg: number; ag: number; hxg: number; axg: number };
type P = { pHome: number; pDraw: number; pAway: number };

async function load(league: string, season: number): Promise<Row[]> {
  const r = await fetch(`https://understat.com/getLeagueData/${league}/${season}`, {
    headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest" },
  });
  if (!r.ok) throw new Error(`${league}/${season} HTTP ${r.status}`);
  const body = (await r.json()) as {
    dates: { isResult: boolean; datetime: string; h: { title: string }; a: { title: string };
      goals: { h: string; a: string }; xG: { h: string; a: string } }[];
  };
  return body.dates
    .filter((d) => d.isResult)
    .map((d) => ({
      date: d.datetime, home: d.h.title, away: d.a.title,
      hg: Number(d.goals.h), ag: Number(d.goals.a), hxg: Number(d.xG.h), axg: Number(d.xG.a),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function figures(prior: Row[], team: string) {
  const home = prior.filter((r) => r.home === team).slice(-10);
  const away = prior.filter((r) => r.away === team).slice(-10);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  if (!home.length && !away.length) return null;
  return {
    xg_home: avg(home.map((r) => r.hxg)), xga_home: avg(home.map((r) => r.axg)),
    xg_away: avg(away.map((r) => r.axg)), xga_away: avg(away.map((r) => r.hxg)),
  };
}

const outcome = (r: Row) => (r.hg > r.ag ? 0 : r.hg === r.ag ? 1 : 2);
const brier = (p: P, y: number) => [p.pHome, p.pDraw, p.pAway].reduce((s, v, i) => s + (v - (i === y ? 1 : 0)) ** 2, 0);
const logloss = (p: P, y: number) => -Math.log(Math.max(1e-12, [p.pHome, p.pDraw, p.pAway][y]));

async function main() {
  const season = understatSeason();
  const tot = { n: 0, bOff: 0, bOn: 0, lOff: 0, lOn: 0, dAbs: 0, dMax: 0, xgUsed: 0 };
  for (const [code, name] of Object.entries(LEAGUES)) {
    const prev = await load(name, season - 1);
    const cur = await load(name, season);
    const l = { n: 0, bOff: 0, bOn: 0 };
    for (const fix of cur) {
      const kickoff = new Date(fix.date.replace(" ", "T") + "Z").getTime();
      const from = kickoff - 365 * 86_400_000;
      const training: MatchResult[] = [...prev, ...cur]
        .filter((r) => { const t = new Date(r.date.replace(" ", "T") + "Z").getTime(); return t >= from && t < kickoff; })
        .map((r) => ({ homeTeam: r.home, awayTeam: r.away, homeGoals: r.hg, awayGoals: r.ag }));
      const model = buildModel(training);
      if (!model) continue;
      const priorCur = cur.filter((r) => r.date < fix.date);
      const figs = new Map<string, NonNullable<ReturnType<typeof figures>>>();
      for (const t of new Set(priorCur.flatMap((r) => [r.home, r.away]))) {
        const f = figures(priorCur, t);
        if (f) figs.set(t, f);
      }
      const teams = [...figs.values()].filter((t) => t.xg_home > 0 || t.xg_away > 0);
      const league = teams.length >= 6
        ? { home: teams.reduce((s, t) => s + t.xg_home, 0) / teams.length, away: teams.reduce((s, t) => s + t.xg_away, 0) / teams.length }
        : null;
      const off = predict(fix.home, fix.away, model);
      const on = predict(fix.home, fix.away, model, { home: figs.get(fix.home) ?? null, away: figs.get(fix.away) ?? null, league });
      if (!off || !on || !off.reliable) continue;
      const pOff = applyTemperature(off);
      const pOn = applyTemperature(on);
      const y = outcome(fix);
      const d = Math.max(Math.abs(pOn.pHome - pOff.pHome), Math.abs(pOn.pDraw - pOff.pDraw), Math.abs(pOn.pAway - pOff.pAway));
      tot.n++; l.n++;
      tot.bOff += brier(pOff, y); tot.bOn += brier(pOn, y); l.bOff += brier(pOff, y); l.bOn += brier(pOn, y);
      tot.lOff += logloss(pOff, y); tot.lOn += logloss(pOn, y);
      tot.dAbs += d; tot.dMax = Math.max(tot.dMax, d);
      if (league && (figs.has(fix.home) || figs.has(fix.away))) tot.xgUsed++;
    }
    console.log(`${code}: n=${l.n}  Brier off ${(l.bOff / l.n).toFixed(4)}  on ${(l.bOn / l.n).toFixed(4)}  Δ ${((l.bOn - l.bOff) / l.n).toFixed(4)}`);
  }
  const f = (x: number) => (x / tot.n).toFixed(4);
  console.log(`\nALL season ${season}: n=${tot.n} (xG used on ${tot.xgUsed})`);
  console.log(`Brier    off ${f(tot.bOff)}  on ${f(tot.bOn)}  Δ ${f(tot.bOn - tot.bOff)}`);
  console.log(`LogLoss  off ${f(tot.lOff)}  on ${f(tot.lOn)}  Δ ${f(tot.lOn - tot.lOff)}`);
  console.log(`max-outcome |Δp| mean ${f(tot.dAbs)}  max ${tot.dMax.toFixed(4)}`);
  // Paired bootstrap on per-match Brier deltas is not done: n is small, read Δ as indicative only.
}

main().catch((e) => { console.error(e); process.exit(1); });
