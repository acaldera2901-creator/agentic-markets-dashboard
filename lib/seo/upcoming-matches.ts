// lib/seo/upcoming-matches.ts — #SEO-AEO-1106: the public list of upcoming matches, readable WITHOUT JavaScript.
// /predictions is a client-rendered board: a crawler (or an AI assistant) used to get an empty shell. This reads ONLY public-safe fields
// (competition, teams/players, kickoff) with the same window/filters as /api/v2/predictions for an anonymous visitor — never model %, odds, picks or edge.
import { dbQuery } from "@/lib/db";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";

export type UpcomingMatch = { id: string; sport: "football" | "tennis"; competition: string; home: string; away: string; startsAt: string };

type Row = { id: string; sport: string; competition: string | null; league: string | null; home_team: string | null; away_team: string | null; player_one: string | null; player_two: string | null; starts_at: string | Date };

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Rows (several markets per match) → one entry per match; rows without two names or with an invalid date are dropped. Pure. */
export function toMatches(rows: readonly Row[], limit = 24): UpcomingMatch[] {
  const seen = new Set<string>();
  const out: UpcomingMatch[] = [];
  for (const r of rows) {
    const tennis = r.sport === "tennis";
    // Live data keeps tennis players in home_team/away_team (player_one/two may be null): read both, as pick-view-model does.
    const home = clean(r.home_team ?? r.player_one);
    const away = clean(r.away_team ?? r.player_two);
    const t = new Date(r.starts_at);
    if (!home || !away || Number.isNaN(t.getTime())) continue;
    const key = `${home}|${away}|${t.toISOString()}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: String(r.id), sport: tennis ? "tennis" : "football", competition: clean(r.competition) || clean(r.league) || (tennis ? "Tennis" : "Football"), home, away, startsAt: t.toISOString() });
    if (out.length >= limit) break;
  }
  return out;
}

/** At most ceil(limit/2) per sport so one sport (e.g. a tennis-heavy week) cannot fill the list; leftover room goes to the other sport. Sorted by kickoff. Pure. */
export function balance(all: readonly UpcomingMatch[], limit: number): UpcomingMatch[] {
  const quota = Math.ceil(limit / 2);
  const per = { football: 0, tennis: 0 };
  const first = all.filter((m) => per[m.sport]++ < quota);
  const rest = all.filter((m) => !first.includes(m));
  return [...first, ...rest].slice(0, limit).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Same public window as /api/v2/predictions (not demo, not historical, published, next PREDICTION_WINDOW_DAYS). Fail-soft: [] on any error. */
export async function fetchUpcomingMatches(limit = 24): Promise<UpcomingMatch[]> {
  try {
    const rows = await dbQuery<Row>(
      `SELECT id, sport, competition, league, home_team, away_team, player_one, player_two, starts_at
         FROM (
               SELECT id, sport, competition, league, home_team, away_team, player_one, player_two, starts_at,
                      ROW_NUMBER() OVER (PARTITION BY sport ORDER BY starts_at ASC) AS rn
                 FROM unified_predictions
                WHERE starts_at > NOW() - interval '150 minutes'
                  AND starts_at < NOW() + ($1 || ' days')::interval
                  AND expires_at > NOW() - interval '150 minutes'
                  AND published_at IS NOT NULL AND is_historical = FALSE AND is_demo = FALSE
              ) t
        WHERE rn <= $2
        ORDER BY starts_at ASC`,
      [PREDICTION_WINDOW_DAYS, limit * 6]
    );
    return balance(toMatches(rows, Infinity), limit);
  } catch (e) {
    console.error("[seo/upcoming-matches]", String(e));
    return [];
  }
}
