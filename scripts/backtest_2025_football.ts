/**
 * #BACKTEST-2025-1 — labelled, walk-forward 2025 backtest of the PRODUCTION
 * football model (top-5 leagues). Analysis/lab output only: writes a JSON
 * artifact, never the live `bets` track record.
 *
 * Mirrors production bit-for-bit by importing the SAME serving primitives:
 *   buildModel -> predict -> applyTemperature(tau=1.2) -> devig1x2 ->
 *   blendWithMarket(alpha=0.3).
 *
 * Honesty / methodology (also surfaced in the UI disclaimer):
 *  - Walk-forward, NO look-ahead: each match is predicted from a model trained
 *    ONLY on that league's earlier matches in the same 2025-26 season.
 *  - Only matches with kickoff in calendar 2025 are EVALUATED (training may use
 *    earlier 2025 matches only).
 *  - Served prob = calibrated model blended with de-vigged Pinnacle CLOSING
 *    (the production formula). Pick = argmax served prob.
 *  - ROI = flat 1u on the pick at B365 (a real takeable price); CLV = that
 *    price vs Pinnacle closing. Rows without the needed odds skip ROI/CLV but
 *    still count for hit-rate. xG blend is NOT applied (no historical Understat
 *    feed) — a documented simplification, never a fabricated input.
 *
 * Run:  npx tsx scripts/backtest_2025_football.ts
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildModel,
  predict,
  devig1x2,
  blendWithMarket,
  MARKET_BLEND_ALPHA,
  MatchResult,
} from "../lib/poisson-model";
import { applyTemperature } from "../lib/calibration";

const DATA_DIR = join(__dirname, "..", "data", "football_data_uk");
// filename prefix -> (league code, display name). football-data.co.uk Div code in 2nd token.
const LEAGUES: Record<string, { code: string; name: string }> = {
  SA: { code: "SA", name: "Serie A" },
  PL: { code: "PL", name: "Premier League" },
  PD: { code: "PD", name: "La Liga" },
  BL1: { code: "BL1", name: "Bundesliga" },
  FL1: { code: "FL1", name: "Ligue 1" },
};

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const r: Row = {};
    header.forEach((h, i) => (r[h.trim()] = (cells[i] ?? "").trim()));
    return r;
  });
}

// football-data.co.uk dates are DD/MM/YYYY (occasionally YY).
function parseDate(d: string): Date | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  return new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
}

function num(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Match = {
  date: Date;
  home: string;
  away: string;
  fthg: number;
  ftag: number;
  ftr: "H" | "D" | "A";
  // takeable price (B365, fallback Avg) + Pinnacle closing
  oddsH: number | null; oddsD: number | null; oddsA: number | null;
  closeH: number | null; closeD: number | null; closeA: number | null;
};

function loadLeague(prefix: string): Match[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.startsWith(prefix + "_") && f.endsWith("_2025.csv"));
  const out: Match[] = [];
  for (const f of files) {
    for (const r of parseCsv(readFileSync(join(DATA_DIR, f), "utf8"))) {
      const date = parseDate(r["Date"]);
      const fthg = num(r["FTHG"]), ftag = num(r["FTAG"]);
      const ftr = r["FTR"] as "H" | "D" | "A";
      if (!date || fthg == null || ftag == null || !["H", "D", "A"].includes(ftr) || !r["HomeTeam"]) continue;
      out.push({
        date, home: r["HomeTeam"], away: r["AwayTeam"], fthg, ftag, ftr,
        oddsH: num(r["B365H"]) ?? num(r["AvgH"]),
        oddsD: num(r["B365D"]) ?? num(r["AvgD"]),
        oddsA: num(r["B365A"]) ?? num(r["AvgA"]),
        closeH: num(r["PSCH"]) ?? num(r["AvgCH"]) ?? num(r["MaxCH"]),
        closeD: num(r["PSCD"]) ?? num(r["AvgCD"]) ?? num(r["MaxCD"]),
        closeA: num(r["PSCA"]) ?? num(r["AvgCA"]) ?? num(r["MaxCA"]),
      });
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

type Pick = {
  competition: string; date: string; home: string; away: string;
  result: "H" | "D" | "A"; pick: "HOME" | "DRAW" | "AWAY"; won: boolean;
  pHome: number; pDraw: number; pAway: number;
  oddsTaken: number | null; closingOdds: number | null;
  roi: number | null; clvPct: number | null; reliable: boolean;
};

const SEL = ["HOME", "DRAW", "AWAY"] as const;
const RES_TO_SEL: Record<string, (typeof SEL)[number]> = { H: "HOME", D: "DRAW", A: "AWAY" };

function backtestLeague(name: string, matches: Match[]): Pick[] {
  const picks: Pick[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.date.getUTCFullYear() !== 2025) continue; // evaluate 2025 only
    // walk-forward training: this league's earlier matches only (no look-ahead)
    const training: MatchResult[] = matches.slice(0, i).map((p) => ({
      homeTeam: p.home, awayTeam: p.away, homeGoals: p.fthg, awayGoals: p.ftag,
    }));
    const model = buildModel(training);
    if (!model) continue;
    const probs = predict(m.home, m.away, model);
    if (!probs) continue;
    // production serving formula: temperature calibration then market blend
    const calib = applyTemperature({ pHome: probs.pHome, pDraw: probs.pDraw, pAway: probs.pAway });
    const market = devig1x2(m.closeH, m.closeD, m.closeA);
    const served = blendWithMarket(calib, market, MARKET_BLEND_ALPHA);
    const probArr = [served.pHome, served.pDraw, served.pAway];
    const pickIdx = probArr.indexOf(Math.max(...probArr));
    const pick = SEL[pickIdx];
    const won = RES_TO_SEL[m.ftr] === pick;
    const oddsTaken = [m.oddsH, m.oddsD, m.oddsA][pickIdx];
    const closingOdds = [m.closeH, m.closeD, m.closeA][pickIdx];
    // ROI: flat 1u on the pick at the takeable price
    const roi = oddsTaken != null ? (won ? oddsTaken - 1 : -1) : null;
    // CLV: implied-prob improvement of the taken price vs the closing line
    const clvPct =
      oddsTaken != null && closingOdds != null
        ? (1 / closingOdds - 1 / oddsTaken) * 100
        : null;
    picks.push({
      competition: name, date: m.date.toISOString().slice(0, 10),
      home: m.home, away: m.away, result: m.ftr, pick, won,
      pHome: served.pHome, pDraw: served.pDraw, pAway: served.pAway,
      oddsTaken, closingOdds, roi, clvPct, reliable: probs.reliable,
    });
  }
  return picks;
}

function summarize(picks: Pick[]) {
  const rel = picks.filter((p) => p.reliable);
  const settled = rel.length;
  const won = rel.filter((p) => p.won).length;
  const roiRows = rel.filter((p) => p.roi != null);
  const roiSum = roiRows.reduce((s, p) => s + (p.roi as number), 0);
  const clvRows = rel.filter((p) => p.clvPct != null);
  const clvSum = clvRows.reduce((s, p) => s + (p.clvPct as number), 0);
  const beatClose = clvRows.filter((p) => (p.clvPct as number) > 0).length;
  return {
    matches: settled,
    won, lost: settled - won,
    hit_rate: settled ? +((won / settled) * 100).toFixed(1) : 0,
    roi_pct: roiRows.length ? +((roiSum / roiRows.length) * 100).toFixed(2) : null,
    avg_clv_pct: clvRows.length ? +(clvSum / clvRows.length).toFixed(3) : null,
    beat_close_pct: clvRows.length ? +((beatClose / clvRows.length) * 100).toFixed(1) : null,
  };
}

const allPicks: Pick[] = [];
const perLeague: Record<string, ReturnType<typeof summarize>> = {};
for (const [prefix, meta] of Object.entries(LEAGUES)) {
  const matches = loadLeague(prefix);
  const picks = backtestLeague(meta.name, matches);
  allPicks.push(...picks);
  perLeague[meta.name] = summarize(picks);
  console.log(`[${meta.code}] ${matches.length} matches loaded, ${picks.length} 2025 picks, ${perLeague[meta.name].matches} reliable`);
}

const overall = summarize(allPicks);
const artifact = {
  meta: {
    id: "#BACKTEST-2025-1", sport: "football", season: "2025-26",
    evaluated_window: "calendar 2025",
    method: "walk-forward, no look-ahead; production serving formula (Dixon-Coles + tau=1.2 calibration + Pinnacle-closing market blend alpha=0.3); xG blend not applied",
    leagues: Object.keys(perLeague),
    generated_for: "labelled simulation panel — NOT the live track record",
  },
  overall, per_league: perLeague,
  picks: allPicks,
};
const outPath = join(__dirname, "..", "data", "backtest_2025_football.json");
writeFileSync(outPath, JSON.stringify(artifact, null, 2));
console.log("\nOVERALL", JSON.stringify(overall));
console.log("per-league", JSON.stringify(perLeague, null, 1));
console.log("wrote", outPath, `(${allPicks.length} picks)`);
