import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";
import { isSurfacedRow } from "@/lib/surfacing-gate";

export const dynamic = "force-dynamic";

type HistoryRow = Pick<
  UnifiedPrediction,
  | "id" | "sport" | "competition" | "event_name" | "home_team" | "away_team"
  | "player_one" | "player_two" | "market" | "pick" | "status"
  | "result" | "signal_type" | "is_paper" | "is_verified" | "is_demo"
  | "starts_at" | "settled_at" | "notes" | "world_cup_stage" | "group_name"
  | "confidence_score"
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

  // Demo rows must never appear in the public track record (defensive).
  const conditions: string[] = ["is_historical = TRUE", "is_demo = FALSE"];
  const values: unknown[] = [];

  if (sport && sport !== "all") {
    values.push(sport);
    conditions.push(`sport = $${values.length}`);
  }
  if (competition && competition !== "all") {
    values.push(`%${competition}%`);
    conditions.push(`competition ILIKE $${values.length}`);
  }

  const fetched = await dbQuery<HistoryRow>(
    `SELECT id, sport, competition, event_name, home_team, away_team,
            player_one, player_two, market, pick, status,
            result, signal_type, is_paper, is_verified, is_demo,
            starts_at, settled_at, notes, world_cup_stage, group_name,
            confidence_score
     FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY COALESCE(settled_at, starts_at) DESC
     LIMIT ${limit}`,
    values
  );

  // SURFACED-ONLY track record (#WINRATE-FLOOR-1). The confidence-surfacing gate
  // suppresses low-confidence rows on the board as "no clear favourite" (no
  // directional pick). The public hit-rate must measure ONLY the picks we
  // actually surfaced — counting a match where we declined to pick as a
  // "loss" understated the win-rate (football 55%→94%, all 52%→71% on live
  // settled data, 2026-06-11). Floors mirror core/surfacing_gate.py via
  // lib/surfacing-gate.ts (single source of truth). Probability-neutral.
  const rows = fetched.filter(isSurfacedRow);

  // Gate every row through the same per-tier projection as /api/v2/predictions so
  // the pick/insight is never leaked to anonymous/free visitors. Outcome counts
  // (won/lost/accuracy) are aggregate hit-rate stats — no money is exposed.
  // final_score (#021): the settlement agents write the REAL result into notes
  // ({"final_score": "2-1" | "6-4 6-3"}); a final score is a public fact, so it
  // is attached after projection and visible on locked rows too.
  // History (settlata) non fa parte della vetrina settimanale: è un gate piatto
  // per piano pagato. rank 0 = sbloccata per base/premium/admin; ∞ = bloccata
  // per free/anonimo (comportamento invariato rispetto al vecchio flag PotD=false).
  const paidState = state === "base" || state === "premium" || state === "admin_full";
  const history = rows.map((row) => {
    const projected = projectPrediction(
      row as unknown as Record<string, unknown>, state, paidState ? 0 : Infinity
    );
    let finalScore: string | null = null;
    try {
      const parsed = JSON.parse(row.notes ?? "");
      if (typeof parsed?.final_score === "string") finalScore = parsed.final_score;
    } catch { /* rows without notes simply show no score */ }
    return { ...projected, final_score: finalScore };
  });

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
