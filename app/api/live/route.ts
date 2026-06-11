import { NextResponse } from "next/server";
import { fetchAllTodayMatches } from "@/lib/football-data";
import { dbQuery } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { settlePredictionLog } from "@/lib/prediction-log";

export const dynamic = "force-dynamic";

export interface LiveScore {
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  minute: number | null;
  // #021: team names so the "Live now" strip can render matches that have
  // already left the upcoming board (kickoff <= NOW()) — real feed data.
  home_team?: string;
  away_team?: string;
}

// #LIVE-1: live scores per le competizioni ESPN-only (FRIENDLY) — le righe
// hanno match_id "espn:<id>", che football-data.org non conosce. Stessa shape
// del feed fdorg; fail-soft: ESPN giù = niente barra live, mai un errore.
const ESPN_STATUS: Record<string, string> = {
  STATUS_IN_PROGRESS: "IN_PLAY",
  STATUS_FIRST_HALF: "IN_PLAY",
  STATUS_SECOND_HALF: "IN_PLAY",
  STATUS_HALFTIME: "PAUSED",
  STATUS_FULL_TIME: "FINISHED",
  STATUS_FINAL: "FINISHED",
};

async function fetchEspnLeagueLive(league: string): Promise<Record<string, LiveScore>> {
  const out: Record<string, LiveScore> = {};
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${today}`,
      { cache: "no-store" }
    );
    if (!resp.ok) return out;
    const data = await resp.json();
    for (const ev of data?.events ?? []) {
      const comp = ev?.competitions?.[0];
      const home = comp?.competitors?.find((c: { homeAway?: string }) => c.homeAway === "home");
      const away = comp?.competitors?.find((c: { homeAway?: string }) => c.homeAway === "away");
      if (!home || !away) continue;
      const statusName = String(ev?.status?.type?.name ?? "");
      const status = ESPN_STATUS[statusName] ?? (ev?.status?.type?.completed ? "FINISHED" : null);
      if (!status) continue; // pre-match: nothing to show
      const minute = parseInt(String(ev?.status?.displayClock ?? ""), 10);
      out[`espn:${ev.id}`] = {
        home_score: Number.isFinite(Number(home.score)) ? Number(home.score) : null,
        away_score: Number.isFinite(Number(away.score)) ? Number(away.score) : null,
        match_status: status,
        minute: Number.isFinite(minute) ? minute : null,
        home_team: home?.team?.displayName,
        away_team: away?.team?.displayName,
      };
    }
  } catch { /* ESPN down: live bar simply absent */ }
  return out;
}

export async function GET(req: Request) {
  const { deny } = await requireAccess(req);
  if (deny) return deny;
  const [matches, espnFriendly, espnWorldCup] = await Promise.all([
    fetchAllTodayMatches(),
    fetchEspnLeagueLive("fifa.friendly"),
    // #WC-LIVE-1: the World Cup lives on ESPN's fifa.world scoreboard, not
    // fifa.friendly. football-data's plan doesn't surface WC in-play (returns
    // count:0 / TIER_ONE on /matches), so ESPN is the only live WC source.
    fetchEspnLeagueLive("fifa.world"),
  ]);

  const liveMap: Record<string, LiveScore> = { ...espnFriendly, ...espnWorldCup };
  for (const m of matches) {
    liveMap[m.id] = {
      home_score: m.homeGoals,
      away_score: m.awayGoals,
      match_status: m.status,
      minute: m.minute,
      home_team: m.homeTeam,
      away_team: m.awayTeam,
    };
  }

  for (const m of matches) {
    if (m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "FINISHED") {
      await dbQuery(
        `UPDATE match_predictions
         SET home_score = $1, away_score = $2, match_status = $3
         WHERE match_id = $4`,
        [m.homeGoals, m.awayGoals, m.status, m.id]
      ).catch((e: unknown) => console.error("[live] DB error:", e));
    }
    // PROPOSAL A settlement: stamp the realized 1X2 result onto the served
    // snapshots once the match is final. Idempotent + fail-soft (only touches
    // open rows, never throws). This is the point with both match_id and score.
    if (m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null) {
      await settlePredictionLog(m.id, m.homeGoals, m.awayGoals);
    }
  }

  return NextResponse.json({ live: liveMap, updated: new Date().toISOString() });
}
