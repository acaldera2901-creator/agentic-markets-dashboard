// lib/world-cup.ts — World Cup hub data layer (Track B, design:
// docs/superpowers/specs/2026-06-05-world-cup-wing-design.md).
//
// Groups/standings/calendar are proxied from the free ESPN site API (same
// source family as core/espn_soccer_client.py used by Track A): one source of
// truth, zero new tables, standings populate themselves once matches settle.
// Squads come from the wc_squads tables written by Track A.

export const WC_KICKOFF_ISO = "2026-06-11T19:00:00Z";

const ESPN_STANDINGS =
  "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026";
const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260601-20260801&limit=250";

export type WcStandingRow = {
  team: string;
  logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
};

export type WcGroup = { name: string; teams: WcStandingRow[] };

export type WcFixture = {
  id: string;
  date: string; // ISO8601 kickoff
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  venue: string | null;
  city: string | null;
  group: string | null; // 'A'..'L' for group stage, null in knockouts
  stage: "group" | "round32" | "round16" | "quarter" | "semi" | "final";
  status: string; // pre | in | post
  home_score: number | null;
  away_score: number | null;
};

function statValue(stats: Array<{ name?: string; value?: number }>, name: string): number {
  const s = (stats || []).find((x) => x.name === name);
  return typeof s?.value === "number" ? s.value : 0;
}

// 2026 format: 72 group matches (Jun 11-27), then R32/R16/QF/SF/Final.
// Stage windows from the official calendar; date-based inference keeps the
// proxy stateless (ESPN notes are empty pre-tournament).
export function inferStage(dateIso: string): WcFixture["stage"] {
  const d = dateIso.slice(0, 10);
  if (d <= "2026-06-27") return "group";
  if (d <= "2026-07-03") return "round32";
  if (d <= "2026-07-08") return "round16";
  if (d <= "2026-07-12") return "quarter";
  if (d <= "2026-07-16") return "semi";
  return "final";
}

export function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ESPN displayName slugs that differ from the canonical dataset spelling the
// wc_squads tables are keyed on (TS mirror of the relevant _TEAM_ALIASES
// entries in core/world_cup_history.py). Without this, hub links built from
// ESPN names 404 against canonical team pages (found in visual QA 2026-06-06).
const SLUG_TO_CANONICAL: Record<string, string> = {
  "cape-verde": "cabo verde",
  "turkiye": "turkey",
  "bosnia-herzegovina": "bosnia and herzegovina",
  "czechia": "czech republic",
  "curacao": "curaçao", // slug strips the cedilla; ILIKE needs the real char
  "usa": "united states",
  "korea-republic": "south korea",
  "ir-iran": "iran",
};

// What to feed the wc_squads ILIKE lookup for a given /world-cup/[team] slug.
export function teamNeedleFromSlug(slug: string): string {
  const key = slug.toLowerCase();
  return SLUG_TO_CANONICAL[key] || key.replace(/-/g, " ").trim();
}

type EspnStandingsResponse = {
  children?: Array<{
    name?: string;
    standings?: {
      entries?: Array<{
        team?: { displayName?: string; logos?: Array<{ href?: string }> };
        stats?: Array<{ name?: string; value?: number }>;
      }>;
    };
  }>;
};

export async function fetchWcGroups(): Promise<WcGroup[]> {
  const res = await fetch(ESPN_STANDINGS, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const data = (await res.json()) as EspnStandingsResponse;
  const groups: WcGroup[] = [];
  for (const child of data.children || []) {
    const name = (child.name || "").replace(/^Group\s+/i, "").trim();
    if (!name) continue;
    const teams: WcStandingRow[] = (child.standings?.entries || []).map((e) => ({
      team: e.team?.displayName || "",
      logo: e.team?.logos?.[0]?.href || null,
      played: statValue(e.stats || [], "gamesPlayed"),
      won: statValue(e.stats || [], "wins"),
      drawn: statValue(e.stats || [], "ties"),
      lost: statValue(e.stats || [], "losses"),
      goals_for: statValue(e.stats || [], "pointsFor"),
      goals_against: statValue(e.stats || [], "pointsAgainst"),
      points: statValue(e.stats || [], "points"),
    }));
    teams.sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));
    groups.push({ name, teams });
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

// team displayName -> group letter, derived from the standings payload so
// calendar and groups can never disagree (same upstream snapshot family).
export async function fetchTeamGroupMap(): Promise<Record<string, string>> {
  const groups = await fetchWcGroups();
  const map: Record<string, string> = {};
  for (const g of groups) for (const t of g.teams) map[t.team] = g.name;
  return map;
}

type EspnScoreboardResponse = {
  events?: Array<{
    id?: string;
    date?: string;
    competitions?: Array<{
      venue?: { fullName?: string; address?: { city?: string } };
      status?: { type?: { state?: string } };
      competitors?: Array<{
        homeAway?: string;
        score?: string;
        team?: { displayName?: string; logo?: string };
      }>;
    }>;
  }>;
};

export async function fetchWcFixtures(): Promise<WcFixture[]> {
  const [res, groupMap] = await Promise.all([
    fetch(ESPN_SCOREBOARD, { next: { revalidate: 300 } }),
    fetchTeamGroupMap(),
  ]);
  if (!res.ok) return [];
  const data = (await res.json()) as EspnScoreboardResponse;
  const fixtures: WcFixture[] = [];
  for (const ev of data.events || []) {
    const comp = ev.competitions?.[0];
    if (!ev.date || !comp) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) continue;
    const stage = inferStage(ev.date);
    const started = comp.status?.type?.state !== "pre";
    fixtures.push({
      id: ev.id || `${ev.date}-${home.team.displayName}`,
      date: ev.date,
      home_team: home.team.displayName,
      away_team: away.team.displayName,
      home_logo: home.team.logo || null,
      away_logo: away.team.logo || null,
      venue: comp.venue?.fullName || null,
      city: comp.venue?.address?.city || null,
      group: stage === "group" ? groupMap[home.team.displayName] || groupMap[away.team.displayName] || null : null,
      stage,
      status: comp.status?.type?.state || "pre",
      home_score: started && home.score != null ? Number(home.score) : null,
      away_score: started && away.score != null ? Number(away.score) : null,
    });
  }
  fixtures.sort((a, b) => a.date.localeCompare(b.date));
  return fixtures;
}
