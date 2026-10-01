export interface TeamXG {
  name: string;
  xg_home: number;   // avg xG last 10 home matches
  xga_home: number;  // avg xGA last 10 home matches
  xg_away: number;   // avg xG last 10 away matches
  xga_away: number;  // avg xGA last 10 away matches
  npxg_home: number; // non-penalty xG home
  npxg_away: number; // non-penalty xG away
  ppda: number;      // passes per defensive action (pressing intensity)
  form: string;      // last 5 results "WWDLW"
  xpts: number;      // expected points last 10
}

const UNDERSTAT_LEAGUES: Record<string, string> = {
  SA: "Serie_A",
  PL: "EPL",
  PD: "La_liga",
  BL1: "Bundesliga",
  FL1: "Ligue_1",
};

function avg(arr: Record<string, string>[], key: string): number {
  if (!arr.length) return 0;
  const sum = arr.reduce((s, m) => s + parseFloat(m[key] ?? "0"), 0);
  return Math.round((sum / arr.length) * 100) / 100;
}

function ppda(arr: Record<string, unknown>[]): number {
  if (!arr.length) return 0;
  const total = arr.reduce((s, m) => {
    const p = m.ppda as Record<string, string> | null;
    if (!p) return s;
    const att = parseFloat(p.att ?? "0");
    const def = parseFloat(p.def ?? "1");
    return s + (def > 0 ? att / def : 0);
  }, 0);
  return Math.round((total / arr.length) * 100) / 100;
}

type UnderstatMatch = Record<string, unknown>;
type UnderstatTeams = Record<string, { id: string; title: string; history?: UnderstatMatch[] }>;

// Understat seasons are keyed by their starting year (2026 = 2026/27).
export function understatSeason(now: Date = new Date()): number {
  return now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

// #XG-1001: the `teamsData` blob is no longer inlined in the league HTML; the
// same data now comes from getLeagueData as JSON with numeric values and the
// side in `h_a`. `isHome` is kept only for the legacy string shape.
function isHomeMatch(m: UnderstatMatch): boolean | null {
  if (m.h_a === "h" || m.isHome === "1" || m.isHome === true) return true;
  if (m.h_a === "a" || m.isHome === "0" || m.isHome === false) return false;
  return null;
}

export function parseUnderstatTeams(teams: UnderstatTeams | undefined | null): Record<string, TeamXG> {
  const result: Record<string, TeamXG> = {};
  for (const team of Object.values(teams ?? {})) {
    const history = (team.history ?? []) as Record<string, string>[];
    const home = history.filter((h) => isHomeMatch(h) === true);
    const away = history.filter((h) => isHomeMatch(h) === false);
    const recent10 = history.slice(-10) as Record<string, unknown>[];

    result[team.title] = {
      name: team.title,
      xg_home: avg(home.slice(-10), "xG"),
      xga_home: avg(home.slice(-10), "xGA"),
      xg_away: avg(away.slice(-10), "xG"),
      xga_away: avg(away.slice(-10), "xGA"),
      npxg_home: avg(home.slice(-10), "npxG"),
      npxg_away: avg(away.slice(-10), "npxG"),
      ppda: ppda(recent10),
      form: history
        .slice(-5)
        .map((h) => (h.result === "w" ? "W" : h.result === "d" ? "D" : "L"))
        .join(""),
      xpts: avg(history.slice(-10), "xpts"),
    };
  }
  return result;
}

export async function fetchLeagueXG(
  league: string
): Promise<Record<string, TeamXG>> {
  const leagueName = UNDERSTAT_LEAGUES[league];
  if (!leagueName) return {};

  try {
    const url = `https://understat.com/getLeagueData/${leagueName}/${understatSeason()}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return {};
    const body = (await r.json()) as { teams?: UnderstatTeams };
    return parseUnderstatTeams(body.teams);
  } catch (e) {
    console.warn(`[understat] ${league}:`, e);
    return {};
  }
}

/**
 * Shadow gate (#XG-1001): xG is fetched, cached and shown in the enrichment,
 * but enters the served probabilities only with XG_BLEND_ENABLED=1 (Andrea's
 * call). Off → predict() gets no baseline → today's served numbers, unchanged.
 */
export function xgBlendBaseline(
  xgMap: Record<string, TeamXG>,
  env: Record<string, string | undefined> = process.env
): { home: number; away: number } | null {
  return env.XG_BLEND_ENABLED === "1" ? leagueXGAverages(xgMap) : null;
}

/**
 * League xG baselines for the model blend: average xG scored at home and away
 * across teams with data. Used to normalize team xG into attack/defense ratings
 * (mirrors how goal ratings are normalized by avgHome/avgAway). Returns null
 * when the map is empty or degenerate — callers then skip the blend entirely.
 */
export function leagueXGAverages(
  xgMap: Record<string, TeamXG>
): { home: number; away: number } | null {
  const teams = Object.values(xgMap).filter((t) => t.xg_home > 0 || t.xg_away > 0);
  if (teams.length < 6) return null; // too few teams to define a league baseline
  const home = teams.reduce((s, t) => s + t.xg_home, 0) / teams.length;
  const away = teams.reduce((s, t) => s + t.xg_away, 0) / teams.length;
  if (home <= 0 || away <= 0) return null;
  return { home, away };
}

/** Normalize team name for fuzzy matching (strip suffixes, accents, lowercase). */
export function normTeam(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/\b(FC|AC|AS|SS|US|SSC|AFC|SC|SV|CF|Calcio|1\.\s*FC)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// football-data name (normalized) → Understat title (normalized), for names no
// substring rule can join. Measured on the 2026-10-01 board (#XG-1001).
const TEAM_ALIASES: Record<string, string> = {
  "koln": "cologne",
  "bayer 04 leverkusen": "bayer leverkusen",
  "borussia monchengladbach": "borussia m.gladbach",
  "bayern munchen": "bayern munich",
  "rb leipzig": "rasenballsport leipzig",
  "stade rennais 1901": "rennes",
  "club atletico de madrid": "atletico madrid",
  "rc celta de vigo": "celta vigo",
  "real racing club de santander": "racing santander",
  "internazionale milano": "inter",
  "rcd espanyol de barcelona": "espanyol",
};

/**
 * Find the matching team in the xG map: exact normalized name, then alias,
 * then a substring match only if it is unique. The old first-substring-wins
 * rule gave Paris FC's xG to PSG and vice versa (measured 2026-10-01).
 */
export function matchTeam(
  name: string,
  xgMap: Record<string, TeamXG>
): TeamXG | null {
  const norm = normTeam(name);
  const entries = Object.entries(xgMap).map(([key, data]) => [normTeam(key), data] as const);
  const target = TEAM_ALIASES[norm] ?? norm;
  const exact = entries.find(([k]) => k === target);
  if (exact) return exact[1];
  const fuzzy = entries.filter(([k]) => k !== "" && (k.includes(target) || target.includes(k)));
  return fuzzy.length === 1 ? fuzzy[0][1] : null;
}
