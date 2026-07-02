import { NextResponse, after } from "next/server";
import { fetchAllTodayMatches } from "@/lib/football-data";
import { dbQuery } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { settlePredictionLog } from "@/lib/prediction-log";
import { SUMMER_LIVE_ESPN_SLUGS } from "@/lib/summer-leagues";

export const dynamic = "force-dynamic";

// #LIVE-LATENCY: live scores are GLOBAL (not per-user), so we can share the
// computed feed across requests with a short in-memory TTL. This makes reloads
// and the 60s client poll near-instant instead of re-hitting football-data +
// 6 ESPN scoreboards every single time. Per-instance on serverless — still
// cuts the external round-trips that caused the 5-10s "card appears late".
const LIVE_TTL_MS = 10_000;
type TodayMatch = Awaited<ReturnType<typeof fetchAllTodayMatches>>[number];
let liveCache: { liveMap: Record<string, LiveScore>; matches: TodayMatch[]; ts: number } | null = null;

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

// Fetch the live feed from all sources and build the served map. No DB writes
// here — persistence/settlement is a side effect scheduled via `after()`.
async function computeLive(): Promise<{ liveMap: Record<string, LiveScore>; matches: TodayMatch[] }> {
  const [matches, espnFriendly, espnWorldCup, ...espnSummer] = await Promise.all([
    fetchAllTodayMatches(),
    fetchEspnLeagueLive("fifa.friendly"),
    // #WC-LIVE-1: the World Cup lives on ESPN's fifa.world scoreboard, not
    // fifa.friendly. football-data's plan doesn't surface WC in-play (returns
    // count:0 / TIER_ONE on /matches), so ESPN is the only live WC source.
    fetchEspnLeagueLive("fifa.world"),
    // #LIVE-LEAGUES-0627: summer leagues (Allsvenskan/Eliteserien/LoI/Chinese SL)
    // — same ESPN scoreboards the settler uses, so their cards show in-play/FT
    // scores like the WC. Keyed `espn:<id>` → direct match to the served fixture.
    ...SUMMER_LIVE_ESPN_SLUGS.map((slug) => fetchEspnLeagueLive(slug)),
  ]);

  const liveMap: Record<string, LiveScore> = { ...espnFriendly, ...espnWorldCup, ...Object.assign({}, ...espnSummer) };
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
  return { liveMap, matches };
}

// Persist live scores + settle finished matches. Runs OFF the response path via
// `after()`: its output never fed the JSON response (the map is built above), so
// awaiting it before responding only added latency. Logic unchanged.
async function persistLive(matches: TodayMatch[]): Promise<void> {
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
}

export async function GET(req: Request) {
  const { deny } = await requireAccess(req);
  if (deny) return deny;

  const now = Date.now();
  if (liveCache && now - liveCache.ts < LIVE_TTL_MS) {
    // Warm cache: serve immediately, no external fetches, no DB writes.
    return NextResponse.json({ live: liveCache.liveMap, updated: new Date(liveCache.ts).toISOString() });
  }

  const { liveMap, matches } = await computeLive();
  liveCache = { liveMap, matches, ts: now };
  // Fresh feed → persist scores + settle finished matches after the response is
  // sent (Vercel keeps the invocation alive via waitUntil). Idempotent, so
  // running it once per TTL window instead of once per request is safe.
  after(() => persistLive(matches));

  return NextResponse.json({ live: liveMap, updated: new Date(now).toISOString() });
}
