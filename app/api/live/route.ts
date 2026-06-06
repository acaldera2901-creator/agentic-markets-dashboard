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
}

export async function GET(req: Request) {
  const { deny } = await requireAccess(req);
  if (deny) return deny;
  const matches = await fetchAllTodayMatches();

  const liveMap: Record<string, LiveScore> = {};
  for (const m of matches) {
    liveMap[m.id] = {
      home_score: m.homeGoals,
      away_score: m.awayGoals,
      match_status: m.status,
      minute: m.minute,
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
