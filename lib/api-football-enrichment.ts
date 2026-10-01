export interface ApiFootballPrediction {
  pct_home: number;
  pct_draw: number;
  pct_away: number;
  advice: string;   // e.g. "Win or Draw for Home"
  winner: string;   // "Home", "Draw", "Away"
}

export interface ApiFootballInjuries {
  home: string[];   // ["Player Name (reason)", ...]
  away: string[];
}

const LEAGUE_IDS: Record<string, number> = {
  PL: 39, SA: 135, PD: 140, BL1: 78, FL1: 61, CL: 2, EL: 3,
};

// Detect whether the key is a RapidAPI key (longer, hex format) or api-sports key
function apiHeaders(key: string): Record<string, string> {
  // RapidAPI keys are typically 50-char hex strings
  if (key.length > 30 && /[a-z]/.test(key) && /[0-9]/.test(key)) {
    return {
      "x-rapidapi-key": key,
      "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
    };
  }
  return { "x-apisports-key": key };
}

function apiBase(key: string): string {
  if (key.length > 30 && /[a-z]/.test(key) && /[0-9]/.test(key)) {
    return "https://api-football-v1.p.rapidapi.com/v3";
  }
  return "https://v3.football.api-sports.io";
}

export interface ApiFixture {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  date: string;
}

function normTeam(name: string): string {
  return name
    .replace(/\b(FC|AC|AS|SS|US|SSC|AFC|SC|SV|CF|Calcio)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function fetchApiFixtures(
  league: string,
  season: number
): Promise<ApiFixture[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];
  const leagueId = LEAGUE_IDS[league];
  if (!leagueId) return [];

  try {
    const url = new URL(`${apiBase(key)}/fixtures`);
    url.searchParams.set("league", String(leagueId));
    url.searchParams.set("season", String(season));
    url.searchParams.set("next", "15");

    const r = await fetch(url.toString(), {
      headers: apiHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return [];

    const data = await r.json() as {
      response: Array<{
        fixture: { id: number; date: string };
        teams: {
          home: { name: string };
          away: { name: string };
        };
      }>;
    };

    return (data.response ?? []).map((f) => ({
      fixtureId: f.fixture.id,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      date: f.fixture.date,
    }));
  } catch (e) {
    console.warn(`[api-football] fixtures ${league}:`, e);
    return [];
  }
}

export async function fetchPrediction(
  fixtureId: number
): Promise<ApiFootballPrediction | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  try {
    const url = new URL(`${apiBase(key)}/predictions`);
    url.searchParams.set("fixture", String(fixtureId));

    const r = await fetch(url.toString(), {
      headers: apiHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;

    const data = await r.json() as {
      response: Array<{
        predictions: {
          percent: { home: string; draw: string; away: string };
          advice: string;
          winner: { name: string | null } | null;
        };
      }>;
    };

    const pred = data.response?.[0]?.predictions;
    if (!pred) return null;

    const homeWinner = pred.winner?.name;
    const pctHome = parseInt(pred.percent.home ?? "0");
    const pctDraw = parseInt(pred.percent.draw ?? "0");
    const pctAway = parseInt(pred.percent.away ?? "0");

    const winner =
      pctHome >= pctDraw && pctHome >= pctAway
        ? "Home"
        : pctDraw >= pctAway
        ? "Draw"
        : "Away";

    return {
      pct_home: pctHome,
      pct_draw: pctDraw,
      pct_away: pctAway,
      advice: pred.advice ?? "",
      winner: homeWinner ?? winner,
    };
  } catch (e) {
    console.warn(`[api-football] prediction ${fixtureId}:`, e);
    return null;
  }
}

export async function fetchInjuries(
  fixtureId: number,
  teams?: { home: string; away: string }
): Promise<ApiFootballInjuries> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { home: [], away: [] };

  try {
    const url = new URL(`${apiBase(key)}/injuries`);
    url.searchParams.set("fixture", String(fixtureId));

    const r = await fetch(url.toString(), {
      headers: apiHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { home: [], away: [] };

    const data = await r.json() as {
      response: Array<{
        player: { name: string; type: string };
        team: { id: number; name?: string };
      }>;
    };

    const response = data.response ?? [];
    if (!response.length) return { home: [], away: [] };

    // #XG-1001: nothing guarantees the response lists the home side first, so the side comes from
    // the fixture's team names; an entry matching neither side is dropped.
    const same = (a: string, b: string) => a !== "" && b !== "" && (a === b || a.includes(b) || b.includes(a));
    const firstId = response[0].team.id;
    const sideOf = (p: (typeof response)[number]): "home" | "away" | null => {
      if (!teams) return p.team.id === firstId ? "home" : "away";
      const tn = normTeam(p.team.name ?? "");
      if (same(tn, normTeam(teams.home))) return "home";
      if (same(tn, normTeam(teams.away))) return "away";
      return null;
    };

    const home: string[] = [];
    const away: string[] = [];

    for (const p of response) {
      const side = sideOf(p);
      if (!side) continue;
      (side === "home" ? home : away).push(`${p.player.name} (${p.player.type})`);
    }

    return { home, away };
  } catch (e) {
    console.warn(`[api-football] injuries ${fixtureId}:`, e);
    return { home: [], away: [] };
  }
}

/**
 * Match our fixture (by team name) to an API-Football fixture.
 * Returns the matching ApiFixture or null.
 */
export function matchFixture(
  homeTeam: string,
  awayTeam: string,
  apiFixtures: ApiFixture[]
): ApiFixture | null {
  const hn = normTeam(homeTeam);
  const an = normTeam(awayTeam);

  for (const f of apiFixtures) {
    const fhn = normTeam(f.homeTeam);
    const fan = normTeam(f.awayTeam);
    const homeMatch = hn === fhn || hn.includes(fhn) || fhn.includes(hn);
    const awayMatch = an === fan || an.includes(fan) || fan.includes(an);
    if (homeMatch && awayMatch) return f;
  }
  return null;
}
