/**
 * #XG-WALKFORWARD-0930 — l'xG migliora il numero SERVITO o no?
 *
 * Contesto: il parser Understat di produzione non ha mai consegnato xG casa/
 * trasferta (isHome vs h_a, #XG-PARSER-0930), quindi il blend xG del modello
 * (Football V4, w=0,5) non e' mai entrato nel servito. `verify-xg-blend.ts`
 * misurava il MODELLO da solo; qui si misura la PIPELINE SERVITA intera, con le
 * funzioni vere di lib/:
 *   training  = partite della lega negli ultimi 365 giorni (lib/football-data fetchHistory)
 *   xG        = ultime ≤10 in casa / ≤10 in trasferta della STAGIONE in corso (pagina Understat)
 *   baseline  = leagueXGAverages (≥6 squadre)
 *   predict → applyTemperature (τ produzione) → blendWithMarket(α=0,3, mercato devig)
 *   mercato   = quote medie pre-partita football-data (Avg*), le piu' vicine al nostro snapshot
 *               (mediana 1,5h prima); la chiusura Pinnacle (PSC*) solo come riferimento.
 *
 * Protocollo walk-forward: il 2021 fa solo da storia; w si SCEGLIE sul 2022;
 * 2023+2024 sono il test intatto, letto una volta. IC bootstrap a blocchi per
 * giornata (data), appaiato sulle stesse partite.
 *
 * Run: npx tsx scripts/lab-xg-servito-walkforward.ts <dataDir>
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildModel, predict, devig1x2, blendWithMarket, MARKET_BLEND_ALPHA,
  type MatchResult, type PoissonModel,
} from "../lib/poisson-model";
import { applyTemperature } from "../lib/calibration";
import { parseUnderstatTeams, leagueXGAverages, type TeamXG } from "../lib/understat";

const DATA = process.argv[2] ?? path.join(__dirname, "..", "data");
const LEAGUES: [string, string, string][] = [
  ["PL", "EPL", "E0"], ["SA", "Serie_A", "I1"], ["PD", "La_liga", "SP1"],
  ["BL1", "Bundesliga", "D1"], ["FL1", "Ligue_1", "F1"],
];
const SEASONS = [2021, 2022, 2023, 2024];
const WEIGHTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0];
const DAY = 86_400_000;

type UMatch = { date: string; t: number; season: number; home: string; away: string; hxg: number; axg: number; hg: number; ag: number };
type Odds = { avg: [number, number, number] | null; psc: [number, number, number] | null };

function csv(file: string): Record<string, string>[] {
  const txt = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const [head, ...lines] = txt.trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => {
    const c = l.split(",");
    return Object.fromEntries(cols.map((k, i) => [k, c[i] ?? ""]));
  });
}

function fdDate(s: string): string {
  const [d, m, y] = s.split("/");
  const yy = y.length === 2 ? `20${y}` : y;
  return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function num(s: string | undefined): number | null {
  const n = Number(s);
  return s && Number.isFinite(n) && n > 1 ? n : null;
}

/** Abbinamento per data + risultato esatto, poi mappa nomi a maggioranza. */
function joinOdds(us: UMatch[], fd: Record<string, string>[]) {
  const fdRows = fd.filter((r) => r.Date && r.HomeTeam).map((r) => ({
    date: fdDate(r.Date), home: r.HomeTeam, away: r.AwayTeam, hg: Number(r.FTHG), ag: Number(r.FTAG),
    odds: {
      avg: num(r.AvgH) && num(r.AvgD) && num(r.AvgA) ? [num(r.AvgH)!, num(r.AvgD)!, num(r.AvgA)!] : null,
      psc: num(r.PSCH) && num(r.PSCD) && num(r.PSCA) ? [num(r.PSCH)!, num(r.PSCD)!, num(r.PSCA)!] : null,
    } as Odds,
  }));
  const byDate = new Map<string, typeof fdRows>();
  for (const r of fdRows) { const v = byDate.get(r.date) ?? []; v.push(r); byDate.set(r.date, v); }
  const votes = new Map<string, Map<string, number>>();
  const vote = (a: string, b: string) => {
    const m = votes.get(a) ?? new Map(); m.set(b, (m.get(b) ?? 0) + 1); votes.set(a, m);
  };
  for (const u of us) {
    const c = (byDate.get(u.date) ?? []).filter((r) => r.hg === u.hg && r.ag === u.ag);
    if (c.length === 1) { vote(u.home, c[0].home); vote(u.away, c[0].away); }
  }
  const map = new Map<string, string>();
  for (const [a, m] of votes) map.set(a, [...m.entries()].sort((x, y) => y[1] - x[1])[0][0]);
  const key = (d: string, h: string, a: string) => `${d}|${h}|${a}`;
  const idx = new Map<string, Odds>();
  for (const r of fdRows) {
    idx.set(key(r.date, r.home, r.away), r.odds);
  }
  const out = new Map<UMatch, Odds>();
  for (const u of us) {
    const h = map.get(u.home), a = map.get(u.away);
    if (!h || !a) continue;
    for (const dd of [0, -1, 1]) {
      const d = new Date(u.t + dd * DAY).toISOString().slice(0, 10);
      const o = idx.get(key(d, h, a));
      if (o) { out.set(u, o); break; }
    }
  }
  return out;
}

/** Le cifre xG come le serve lib/understat.ts: ultime 10 casa/trasferta della stagione. */
function xgMapAt(seasonPrior: UMatch[]): Record<string, TeamXG> {
  const teams: Record<string, { id: string; title: string; history: Record<string, unknown>[] }> = {};
  const push = (name: string, row: Record<string, unknown>) => {
    teams[name] ??= { id: name, title: name, history: [] };
    teams[name].history.push(row);
  };
  for (const m of seasonPrior) {
    const res = (g: number, h: number) => (g > h ? "w" : g === h ? "d" : "l");
    push(m.home, { h_a: "h", xG: m.hxg, xGA: m.axg, npxG: m.hxg, result: res(m.hg, m.ag) });
    push(m.away, { h_a: "a", xG: m.axg, xGA: m.hxg, npxG: m.axg, result: res(m.ag, m.hg) });
  }
  return parseUnderstatTeams(teams);
}

type Pred = { t: number; date: string; league: string; season: number; y: 0 | 1 | 2;
  market: [number, number, number]; close: [number, number, number] | null;
  served: Record<number, [number, number, number]>; model: Record<number, [number, number, number]>; xgOn: boolean };

const brier = (p: [number, number, number], y: number) => p.reduce((s, v, i) => s + (v - (i === y ? 1 : 0)) ** 2, 0);
const logl = (p: [number, number, number], y: number) => -Math.log(Math.max(1e-12, p[y]));

const preds: Pred[] = [];
const joinStats: Record<string, { us: number; joined: number }> = {};

for (const [code, name, fdCode] of LEAGUES) {
  const us: UMatch[] = [];
  for (const s of SEASONS) {
    const f = path.join(DATA, "understat", `${code}_${name}_${s}.csv`);
    if (!fs.existsSync(f)) continue;
    for (const r of csv(f)) {
      us.push({ date: r.date.slice(0, 10), t: Date.parse(r.date.slice(0, 10)), season: s, home: r.home_team, away: r.away_team,
        hxg: Number(r.home_xg), axg: Number(r.away_xg), hg: Number(r.home_goals), ag: Number(r.away_goals) });
    }
  }
  us.sort((a, b) => a.t - b.t);
  const fd: Record<string, string>[] = [];
  for (const s of SEASONS) {
    const tag = `${String(s).slice(2)}${String(s + 1).slice(2)}`;
    const f = path.join(DATA, "football_data_uk_10y", `${tag}_${fdCode}.csv`);
    if (fs.existsSync(f)) fd.push(...csv(f));
  }
  const odds = joinOdds(us, fd);
  joinStats[code] = { us: us.length, joined: odds.size };

  // modello e mappa xG ricostruiti una volta per data (come un giro del cron)
  const dates = [...new Set(us.map((m) => m.date))];
  for (const d of dates) {
    const t = Date.parse(d);
    const today = us.filter((m) => m.date === d);
    const prior = us.filter((m) => m.t < t && m.t >= t - 365 * DAY);
    if (prior.length < 100) continue; // produzione ha sempre ~1 anno di storia
    const model: PoissonModel | null = buildModel(prior.map((m): MatchResult => ({
      homeTeam: m.home, awayTeam: m.away, homeGoals: m.hg, awayGoals: m.ag,
    })));
    if (!model) continue;
    for (const m of today) {
      const o = odds.get(m);
      if (!o?.avg) continue;
      const market = devig1x2(...o.avg)!;
      const close = o.psc ? devig1x2(...o.psc) : null;
      const xgMap = xgMapAt(us.filter((x) => x.season === m.season && x.t < t));
      const base = leagueXGAverages(xgMap);
      const served: Pred["served"] = {}, mod: Pred["model"] = {};
      let ok = true;
      for (const w of WEIGHTS) {
        const p = predict(m.home, m.away, model, { home: xgMap[m.home] ?? null, away: xgMap[m.away] ?? null, league: base, weight: w });
        if (!p) { ok = false; break; }
        const cal = applyTemperature({ pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway });
        const s = blendWithMarket(cal, market, MARKET_BLEND_ALPHA);
        served[w] = [s.pHome, s.pDraw, s.pAway];
        mod[w] = [cal.pHome, cal.pDraw, cal.pAway];
      }
      if (!ok) continue;
      preds.push({ t, date: d, league: code, season: m.season, y: m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2,
        market: [market.home, market.draw, market.away], close: close ? [close.home, close.draw, close.away] : null,
        served, model: mod, xgOn: base != null && !!xgMap[m.home] && !!xgMap[m.away] });
    }
  }
}

function summary(rows: Pred[], label: string) {
  const mean = (f: (p: Pred) => number) => rows.reduce((s, p) => s + f(p), 0) / rows.length;
  const out: Record<string, unknown> = { label, n: rows.length, xg_attivo: rows.filter((r) => r.xgOn).length };
  out.market = { brier: mean((p) => brier(p.market, p.y)), logloss: mean((p) => logl(p.market, p.y)) };
  for (const w of WEIGHTS) {
    out[`served_w${w}`] = { brier: mean((p) => brier(p.served[w], p.y)), logloss: mean((p) => logl(p.served[w], p.y)) };
    out[`model_w${w}`] = { brier: mean((p) => brier(p.model[w], p.y)) };
  }
  return out;
}

/** Bootstrap a blocchi per giornata della differenza media f(p) (appaiata). */
function bootstrap(rows: Pred[], f: (p: Pred) => number, B = 4000, seed = 7) {
  const byDay = new Map<string, number[]>();
  for (const p of rows) { const v = byDay.get(p.date) ?? []; v.push(f(p)); byDay.set(p.date, v); }
  const days = [...byDay.values()];
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const means: number[] = [];
  for (let b = 0; b < B; b++) {
    let sum = 0, n = 0;
    for (let i = 0; i < days.length; i++) { const d = days[Math.floor(rnd() * days.length)]; for (const x of d) { sum += x; n++; } }
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const point = rows.reduce((a, p) => a + f(p), 0) / rows.length;
  return { delta: point, ic95: [means[Math.floor(B * 0.025)], means[Math.floor(B * 0.975)]], giornate: days.length };
}

const sel = preds.filter((p) => p.season === 2022);
const test = preds.filter((p) => p.season >= 2023);
const selSum = summary(sel, "selezione 2022");
const bestW = WEIGHTS.reduce((b, w) =>
  (selSum[`served_w${w}`] as { brier: number }).brier < (selSum[`served_w${b}`] as { brier: number }).brier ? w : b, 0);

const result = {
  generato: new Date().toISOString(),
  join_quote: joinStats,
  n_totale: preds.length,
  w_scelto_su_2022: bestW,
  selezione_2022: selSum,
  test_2023_2024: summary(test, "test 2023-24 (intatto)"),
  test_delta: {
    [`served_w${bestW} − served_w0 (Brier)`]: bootstrap(test, (p) => brier(p.served[bestW], p.y) - brier(p.served[0], p.y)),
    [`served_w0.5 − served_w0 (Brier)`]: bootstrap(test, (p) => brier(p.served[0.5], p.y) - brier(p.served[0], p.y)),
    [`served_w0 − market (Brier)`]: bootstrap(test, (p) => brier(p.served[0], p.y) - brier(p.market, p.y)),
    [`served_w${bestW} − market (Brier)`]: bootstrap(test, (p) => brier(p.served[bestW], p.y) - brier(p.market, p.y)),
    [`model_w${bestW} − model_w0 (Brier)`]: bootstrap(test, (p) => brier(p.model[bestW], p.y) - brier(p.model[0], p.y)),
  },
  per_lega_test: Object.fromEntries(LEAGUES.map(([c]) => {
    const r = test.filter((p) => p.league === c);
    const m = (f: (p: Pred) => number) => r.reduce((s, p) => s + f(p), 0) / Math.max(1, r.length);
    return [c, { n: r.length, market: m((p) => brier(p.market, p.y)), served_w0: m((p) => brier(p.served[0], p.y)),
      [`served_w${bestW}`]: m((p) => brier(p.served[bestW], p.y)) }];
  })),
  riferimento_chiusura_test: (() => {
    const r = test.filter((p) => p.close);
    const m = (f: (p: Pred) => number) => r.reduce((s, p) => s + f(p), 0) / r.length;
    return { n: r.length, close: m((p) => brier(p.close!, p.y)), market_avg: m((p) => brier(p.market, p.y)), served_w0: m((p) => brier(p.served[0], p.y)) };
  })(),
};
// Il modello con xG aggiunge informazione al PREZZO? Se si', esiste un α>0 che
// batte il mercato fuori campione. α scelto sul 2022, letto sul test.
const ALPHAS = [0, 0.05, 0.1, 0.15, 0.2, 0.3];
const mix = (p: Pred, w: number, a: number): [number, number, number] =>
  [0, 1, 2].map((i) => a * p.model[w][i] + (1 - a) * p.market[i]) as [number, number, number];
const alphaSweep: Record<string, unknown> = {};
for (const w of [0, bestW, 0.5]) {
  const mb = (rows: Pred[], a: number) => rows.reduce((s, p) => s + brier(mix(p, w, a), p.y), 0) / rows.length;
  const bestA = ALPHAS.reduce((b, a) => (mb(sel, a) < mb(sel, b) ? a : b), 0);
  alphaSweep[`w${w}`] = {
    alpha_scelto_2022: bestA,
    test_per_alpha: Object.fromEntries(ALPHAS.map((a) => [a, mb(test, a)])),
    [`test α${bestA} − market`]: bootstrap(test, (p) => brier(mix(p, w, bestA), p.y) - brier(p.market, p.y)),
  };
}
(result as Record<string, unknown>).alpha_sweep = alphaSweep;
console.log(JSON.stringify(result, null, 2));
