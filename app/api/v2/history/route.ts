import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";

export const dynamic = "force-dynamic";

type HistoryRow = Pick<
  UnifiedPrediction,
  | "id" | "sport" | "competition" | "event_name" | "home_team" | "away_team"
  | "player_one" | "player_two" | "market" | "pick" | "odds" | "status"
  | "result" | "pnl" | "signal_type" | "is_paper" | "is_verified" | "is_demo"
  | "starts_at" | "settled_at" | "notes" | "world_cup_stage" | "group_name"
>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const limit       = Math.min(Number(searchParams.get("limit") ?? 100), 300);

  const conditions: string[] = ["is_historical = TRUE"];

  if (sport && sport !== "all") {
    conditions.push(`sport = '${sport.replace(/'/g, "''")}'`);
  }
  if (competition && competition !== "all") {
    conditions.push(`competition ILIKE '%${competition.replace(/'/g, "''")}%'`);
  }

  const rows = await dbQuery<HistoryRow>(
    `SELECT id, sport, competition, event_name, home_team, away_team,
            player_one, player_two, market, pick, odds, status,
            result, pnl, signal_type, is_paper, is_verified, is_demo,
            starts_at, settled_at, notes, world_cup_stage, group_name
     FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY COALESCE(settled_at, starts_at) DESC
     LIMIT ${limit}`
  );

  const total    = rows.length;
  const won      = rows.filter((r) => r.result === "won").length;
  const lost     = rows.filter((r) => r.result === "lost").length;
  const paper    = rows.filter((r) => r.is_paper).length;
  const verified = rows.filter((r) => r.is_verified).length;

  return NextResponse.json({
    history: rows,
    stats: {
      total,
      won,
      lost,
      void: rows.filter((r) => r.result === "void").length,
      pending: rows.filter((r) => r.result === "pending" || r.result == null).length,
      paper,
      verified,
      win_rate:
        won + lost > 0
          ? `${((won / (won + lost)) * 100).toFixed(1)}%`
          : null,
    },
  });
}
