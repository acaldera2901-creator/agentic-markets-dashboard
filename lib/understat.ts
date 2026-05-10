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

function unescape(str: string): string {
  return str
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'");
}

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

export async function fetchLeagueXG(
  league: string
): Promise<Record<string, TeamXG>> {
  const leagueName = UNDERSTAT_LEAGUES[league];
  if (!leagueName) return {};

  try {
    const year =
      new Date().getMonth() < 6
        ? new Date().getFullYear() - 1
        : new Date().getFullYear();

    const url = `https://understat.com/league/${leagueName}/${year}`;
    const html = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    }).then((r) => r.text());

    const match = html.match(/var teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
    if (!match) return {};

    const teams = JSON.parse(unescape(match[1])) as Record<
      string,
      { id: string; title: string; history: Record<string, string>[] }
    >;

    const result: Record<string, TeamXG> = {};

    for (const team of Object.values(teams)) {
      const history = team.history ?? [];
      const home = history.filter((h) => h.isHome === "1");
      const away = history.filter((h) => h.isHome === "0");
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
  } catch (e) {
    console.warn(`[understat] ${league}:`, e);
    return {};
  }
}

/** Normalize team name for fuzzy matching (strip suffixes, lowercase). */
export function normTeam(name: string): string {
  return name
    .replace(/\b(FC|AC|AS|SS|US|SSC|AFC|SC|SV|CF|Calcio|1\.\s*FC)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Find best matching team in the xG map by normalized name. */
export function matchTeam(
  name: string,
  xgMap: Record<string, TeamXG>
): TeamXG | null {
  const norm = normTeam(name);
  for (const [key, data] of Object.entries(xgMap)) {
    const keyNorm = normTeam(key);
    if (keyNorm === norm || keyNorm.includes(norm) || norm.includes(keyNorm)) {
      return data;
    }
  }
  return null;
}
