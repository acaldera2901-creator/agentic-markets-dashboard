import { NextResponse } from "next/server";
import { fetchAllTodayMatches } from "@/lib/football-data";

export const dynamic = "force-dynamic";

const DB_URL = process.env.DATABASE_URL ?? "";

export interface LiveScore {
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  minute: number | null;
}

export async function GET() {
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

  if (DB_URL && matches.length > 0) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const db = neon(DB_URL);
      for (const m of matches) {
        if (m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "FINISHED") {
          await db`
            UPDATE match_predictions
            SET home_score = ${m.homeGoals}, away_score = ${m.awayGoals}, match_status = ${m.status}
            WHERE match_id = ${m.id}
          `;
        }
      }
    } catch (e) {
      console.error("[live] DB error:", e);
    }
  }

  return NextResponse.json({ live: liveMap, updated: new Date().toISOString() });
}
