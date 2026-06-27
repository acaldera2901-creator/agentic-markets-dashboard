// Summer-calendar leagues (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12).
//
// The five leagues quality-gated by the walk-forward lab
// (am-lab/lab_summer_leagues.py, 2017-2026 held-out: W1 package ~52 picks/yr
// @74.6%). They cannot ride the football-data.org path (not on the free tier),
// so this module provides the two missing inputs for the EXISTING club
// pipeline — everything downstream (temperature calibration, market blend
// α=0.3, per-league surfacing floor, match_predictions insert, unified sync)
// is untouched:
//
//   1. HISTORY for the Poisson model: shipped snapshot
//      data/summer_leagues/history.json — last 365 days of results from the
//      lab CSVs with team names REMAPPED to ESPN displayNames at generation
//      time (am-lab/gen_summer_history.py). Refreshed by the lab (weekly is
//      plenty: the served blend is 70% market).
//   2. FIXTURES: ESPN scoreboard (slugs in core/espn_soccer_client.py, probed
//      26/26 on 2026-06-12). Veikkausliiga is the exception — ESPN's fin.1
//      payload is empty, so VEI fixtures derive from The Odds API /events
//      (quota-free endpoint; those are exactly the matches that can be served
//      anyway, since the blend needs odds).
//
// Settlement: app/api/cron/settle reads ESPN scoreboards (espn:* ids) and The
// Odds API /scores (oddsapi:* ids) for these leagues — see the cron route.
//
// QUALITY-FIRST (Michele): a fixture whose teams cannot be matched to the
// model is SKIPPED, never guessed (fail-closed).

import historySnapshot from "@/data/summer_leagues/history.json";
import type { MatchResult } from "@/lib/poisson-model";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import type { FDMatch } from "@/lib/football-data";

// Display names drive the per-league surfacing floor (lib/surfacing-gate.ts
// CLUB_FLOOR_OVERRIDES matches on these): keep them aligned with the lab table.
export const SUMMER_LEAGUES: Record<string, string> = {
  ELI: "Eliteserien",
  ALL: "Allsvenskan",
  VEI: "Veikkausliiga",
  LOI: "League of Ireland",
  CSL: "Chinese Super League",
};

export function isSummerLeague(code: string): boolean {
  return code in SUMMER_LEAGUES;
}

const ESPN_SLUGS: Record<string, string> = {
  ELI: "nor.1",
  ALL: "swe.1",
  VEI: "fin.1", // empty on ESPN — kept for completeness; fixtures come from odds events
  LOI: "irl.1",
  CSL: "chn.1",
};

// #LIVE-LEAGUES-0627: slug ESPN da interrogare anche nel feed LIVE del board
// (/api/live), così le card delle leghe estive mostrano punteggio in-play/finale
// come la World Cup. fin.1 (VEI) escluso: ESPN lo restituisce vuoto e The Odds
// API non va chiamata nel polling 60s (quota). Le card estive hanno match_id
// `espn:<id>` → match diretto col live scoreboard.
export const SUMMER_LIVE_ESPN_SLUGS: string[] = ["nor.1", "swe.1", "irl.1", "chn.1"];

const ODDS_SPORT_KEYS: Record<string, string> = {
  ELI: "soccer_norway_eliteserien",
  ALL: "soccer_sweden_allsvenskan",
  VEI: "soccer_finland_veikkausliiga",
  LOI: "soccer_league_of_ireland",
  CSL: "soccer_china_superleague",
};

type SnapshotShape = {
  generated_at: string;
  leagues: Record<
    string,
    { espn_slug: string; matches: Array<{ homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; date: string }> }
  >;
};

// ── 1. History (shipped snapshot) ────────────────────────────────────────────

export function fetchSummerHistory(code: string): MatchResult[] {
  const league = (historySnapshot as SnapshotShape).leagues[code];
  if (!league) return [];
  return league.matches.map((m) => ({
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
  }));
}

export function summerSnapshotAgeDays(): number {
  const gen = new Date((historySnapshot as SnapshotShape).generated_at);
  return Math.floor((Date.now() - gen.getTime()) / 86_400_000);
}

// ── Team-name matching (fixtures source ↔ model names) ──────────────────────
// The snapshot ships ESPN displayNames where ESPN knows the team, original CSV
// names otherwise (e.g. all of VEI). Sources may still drift ("HJK Helsinki"
// vs "HJK", "Bodø/Glimt" vs "Bodo/Glimt") → normalized containment + token
// overlap; no match → null (caller skips the fixture, fail-closed).

const NOISE = new Set(["fc", "if", "ik", "bk", "afc", "sk", "fk", "ff", "aif", "cf", "sc", "club", "cd"]);

function tokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[/-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w));
}

export function matchModelTeam(sourceName: string, modelTeams: Iterable<string>): string | null {
  const src = tokens(sourceName).join(" ");
  if (!src) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const team of modelTeams) {
    const t = tokens(team).join(" ");
    if (!t) continue;
    if (t === src) return team;
    if (t.includes(src) || src.includes(t)) return team;
    const a = new Set(tokens(sourceName));
    const b = new Set(tokens(team));
    let overlap = 0;
    for (const w of a) if (b.has(w)) overlap += 1;
    const score = overlap / Math.max(a.size, b.size);
    if (score > bestScore) {
      bestScore = score;
      best = team;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

// ── 2. Fixtures ──────────────────────────────────────────────────────────────

const UA = { "User-Agent": "Mozilla/5.0 (compatible; AgenticMarkets/1.0)" };

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchEspnFixtures(code: string): Promise<FDMatch[]> {
  const slug = ESPN_SLUGS[code];
  if (!slug) return [];
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + PREDICTION_WINDOW_DAYS);
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard` +
    `?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=200`;
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      events?: Array<{
        id: string;
        date: string;
        status?: { type?: { state?: string } };
        competitions?: Array<{
          competitors?: Array<{ homeAway: string; team?: { displayName?: string } }>;
        }>;
      }>;
    };
    const out: FDMatch[] = [];
    for (const ev of data.events ?? []) {
      if (ev.status?.type?.state !== "pre") continue; // fixtures only
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home")?.team?.displayName;
      const away = comp?.competitors?.find((c) => c.homeAway === "away")?.team?.displayName;
      if (!home || !away) continue;
      out.push({
        id: `espn:${ev.id}`,
        utcDate: ev.date,
        homeTeam: home,
        awayTeam: away,
        homeGoals: null,
        awayGoals: null,
        status: "SCHEDULED",
        minute: null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// The Odds API /events — quota-free listing of upcoming events. Used as the
// fixtures source where ESPN is empty (VEI) and as a safety net elsewhere.
async function fetchOddsApiEvents(code: string): Promise<FDMatch[]> {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = ODDS_SPORT_KEYS[code];
  if (!apiKey || !sportKey) return [];
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const events = (await r.json()) as Array<{
      id: string;
      commence_time: string;
      home_team: string;
      away_team: string;
    }>;
    const horizon = Date.now() + PREDICTION_WINDOW_DAYS * 86_400_000;
    return events
      .filter((e) => {
        const t = Date.parse(e.commence_time);
        return t > Date.now() && t <= horizon;
      })
      .map((e) => ({
        id: `oddsapi:${e.id}`,
        utcDate: e.commence_time,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        homeGoals: null,
        awayGoals: null,
        status: "SCHEDULED",
        minute: null,
      }));
  } catch {
    return [];
  }
}

export async function fetchSummerFixtures(code: string): Promise<FDMatch[]> {
  const espn = await fetchEspnFixtures(code);
  if (espn.length > 0) return espn;
  return fetchOddsApiEvents(code);
}

// ── 3. Finished results for the settlement cron ─────────────────────────────
// Returns finished matches keyed the same way fixtures were keyed (espn:<id> /
// oddsapi:<id>), so the cron can settle match_predictions rows for these
// leagues exactly like the fd.org ones.

export type FinishedMatch = { id: string; homeGoals: number; awayGoals: number };

async function fetchEspnResults(code: string): Promise<FinishedMatch[]> {
  const slug = ESPN_SLUGS[code];
  if (!slug) return [];
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 3);
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard` +
    `?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=200`;
  try {
    const r = await fetch(url, { headers: UA, cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      events?: Array<{
        id: string;
        status?: { type?: { completed?: boolean; state?: string } };
        competitions?: Array<{
          competitors?: Array<{ homeAway: string; score?: string }>;
        }>;
      }>;
    };
    const out: FinishedMatch[] = [];
    for (const ev of data.events ?? []) {
      if (!ev.status?.type?.completed) continue;
      const comp = ev.competitions?.[0];
      const h = comp?.competitors?.find((c) => c.homeAway === "home")?.score;
      const a = comp?.competitors?.find((c) => c.homeAway === "away")?.score;
      if (h == null || a == null) continue;
      const hg = Number(h);
      const ag = Number(a);
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      out.push({ id: `espn:${ev.id}`, homeGoals: hg, awayGoals: ag });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchOddsApiScores(code: string): Promise<FinishedMatch[]> {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = ODDS_SPORT_KEYS[code];
  if (!apiKey || !sportKey) return [];
  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/scores?apiKey=${apiKey}&daysFrom=3`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{
      id: string;
      completed: boolean;
      home_team: string;
      away_team: string;
      scores: Array<{ name: string; score: string }> | null;
    }>;
    const out: FinishedMatch[] = [];
    for (const row of rows) {
      if (!row.completed || !row.scores) continue;
      const h = row.scores.find((s) => s.name === row.home_team)?.score;
      const a = row.scores.find((s) => s.name === row.away_team)?.score;
      if (h == null || a == null) continue;
      const hg = Number(h);
      const ag = Number(a);
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      out.push({ id: `oddsapi:${row.id}`, homeGoals: hg, awayGoals: ag });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchSummerResults(code: string): Promise<FinishedMatch[]> {
  const [espn, oddsapi] = await Promise.all([
    fetchEspnResults(code),
    fetchOddsApiScores(code),
  ]);
  return [...espn, ...oddsapi];
}
