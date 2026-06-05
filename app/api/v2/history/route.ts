import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";

export const dynamic = "force-dynamic";

type HistoryRow = Pick<
  UnifiedPrediction,
  | "id" | "sport" | "competition" | "event_name" | "home_team" | "away_team"
  | "player_one" | "player_two" | "market" | "pick" | "status"
  | "result" | "signal_type" | "is_paper" | "is_verified" | "is_demo"
  | "starts_at" | "settled_at" | "notes" | "world_cup_stage" | "group_name"
>;

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req); // never denies (read)

  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");

  // Clamp limit to a valid positive integer; NaN/negative/huge → default 100.
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), 300)
    : 100;

  const conditions: string[] = ["is_historical = TRUE"];

  if (sport && sport !== "all") {
    conditions.push(`sport = '${sport.replace(/'/g, "''")}'`);
  }
  if (competition && competition !== "all") {
    conditions.push(`competition ILIKE '%${competition.replace(/'/g, "''")}%'`);
  }

  const rows = await dbQuery<HistoryRow>(
    `SELECT id, sport, competition, event_name, home_team, away_team,
            player_one, player_two, market, pick, status,
            result, signal_type, is_paper, is_verified, is_demo,
            starts_at, settled_at, notes, world_cup_stage, group_name
     FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY COALESCE(settled_at, starts_at) DESC
     LIMIT ${limit}`
  );

  // Gate every row through the same per-tier projection as /api/v2/predictions so
  // the pick/insight is never leaked to anonymous/free visitors. Outcome counts
  // (won/lost/accuracy) are aggregate hit-rate stats — no money is exposed.
  const history = rows.map((row) =>
    projectPrediction(row as unknown as Record<string, unknown>, state, false)
  );

  const total    = rows.length;
  const won      = rows.filter((r) => r.result === "won").length;
  const lost     = rows.filter((r) => r.result === "lost").length;
  const paper    = rows.filter((r) => r.is_paper).length;
  const verified = rows.filter((r) => r.is_verified).length;

  return NextResponse.json({
    history,
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
