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

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function avg(arr: Record<string, unknown>[], key: string): number {
  if (!arr.length) return 0;
  const sum = arr.reduce((s, m) => s + num(m[key]), 0);
  return Math.round((sum / arr.length) * 100) / 100;
}

function ppda(arr: Record<string, unknown>[]): number {
  if (!arr.length) return 0;
  const total = arr.reduce((s, m) => {
    const p = m.ppda as Record<string, unknown> | null;
    if (!p) return s;
    const att = num(p.att);
    const def = p.def == null ? 1 : num(p.def);
    return s + (def > 0 ? att / def : 0);
  }, 0);
  return Math.round((total / arr.length) * 100) / 100;
}

type UnderstatTeams = Record<
  string,
  { id: string; title: string; history: Record<string, unknown>[] }
>;

// #XG-PARSER-0930 (audit agentic_codex 29/09): due guasti sovrapposti.
// 1) Understat non incorpora piu' `var teamsData = JSON.parse('...')` nella
//    pagina: la carica via XHR da `getLeagueData/<lega>/<stagione>` (visto in
//    js/league.min.js). La regex non trovava niente ⇒ `{}` ⇒ cache xG vuota
//    (count 0 in prod al 29/09).
// 2) Lo storico squadra dice casa/trasferta con `h_a: "h"|"a"`, non con
//    `isHome`. Il filtro su `isHome === "1"` restava vuoto anche quando i dati
//    arrivavano: xg_home/xg_away = 0 ⇒ leagueXGAverages = null ⇒ il blend xG del
//    modello (Football V4) non e' mai partito sul servito.
function isHomeRow(h: Record<string, unknown>): boolean | null {
  if (h.h_a === "h") return true;
  if (h.h_a === "a") return false;
  if (h.isHome === "1" || h.isHome === true) return true;
  if (h.isHome === "0" || h.isHome === false) return false;
  return null;
}

/** Dai dati squadra di Understat alle cifre xG per squadra. Pura: testabile sui payload. */
export function parseUnderstatTeams(teams: UnderstatTeams): Record<string, TeamXG> {
  const result: Record<string, TeamXG> = {};
  for (const team of Object.values(teams)) {
    const history = team.history ?? [];
    const home = history.filter((h) => isHomeRow(h) === true);
    const away = history.filter((h) => isHomeRow(h) === false);
    const recent10 = history.slice(-10);

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

/** Vecchio formato: dati incorporati nella pagina. Tenuto come ripiego. */
export function extractTeamsFromHtml(html: string): UnderstatTeams | null {
  const match = html.match(/var teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
  if (!match) return null;
  return JSON.parse(unescape(match[1])) as UnderstatTeams;
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

    const page = `https://understat.com/league/${leagueName}/${year}`;
    let teams: UnderstatTeams | null = null;
    try {
      const r = await fetch(`https://understat.com/getLeagueData/${leagueName}/${year}`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "X-Requested-With": "XMLHttpRequest",
          Referer: page,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) {
        const data = (await r.json()) as { teams?: UnderstatTeams };
        if (data?.teams && Object.keys(data.teams).length) teams = data.teams;
      }
    } catch (e) {
      console.warn(`[understat] ${league} getLeagueData:`, e);
    }
    if (!teams) {
      const html = await fetch(page, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      }).then((r) => r.text());
      teams = extractTeamsFromHtml(html);
    }
    if (!teams) {
      // Non e' "nessun dato": e' la fonte che non risponde nel formato atteso.
      console.warn(`[understat] ${league}: nessun blocco squadre (formato cambiato?)`);
      return {};
    }
    return parseUnderstatTeams(teams);
  } catch (e) {
    console.warn(`[understat] ${league}:`, e);
    return {};
  }
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
