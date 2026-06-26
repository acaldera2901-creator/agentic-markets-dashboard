import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";
import { bySegment } from "@/lib/track-record-history";

// #TRACKREC-REAL-0626: a row counts in the track record iff the board ACTUALLY
// showed it as a directional pick. We read the board's own persisted verdict
// instead of re-deriving the floor (which would drift from what was shown when
// floors change, and mis-handle legacy rows):
//   - `pick` null  → no directional pick was shown (e.g. tennis below floor).
//   - notes.surface.below_floor === true → shown as "no clear favourite", not a pick.
// No surface flag (legacy rows) → the board defaults to showing the pick, so we count it.
function wasShownAsPick(row: { pick?: string | null; notes?: string | null }): boolean {
  if (!row.pick) return false;
  try {
    const surface = (JSON.parse(row.notes ?? "{}") as { surface?: { below_floor?: boolean } }).surface;
    if (surface?.below_floor === true) return false;
  } catch { /* unparseable/absent notes → board shows the pick → count it */ }
  return true;
}

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
  // Additivi (default invariato se assenti): year filtra per anno di starts_at,
  // aggregate=segments,weeks aggiunge i riepiloghi. Vedi spec §4ter: il backfill
  // 2025 dovrà essere marcato a parte per non inquinare la query di default.
  const year      = searchParams.get("year");
  const aggregate = (searchParams.get("aggregate") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // Clamp limit to a valid positive integer; NaN/negative/huge → default 100.
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), 300)
    : 100;

  // Demo rows must never appear in the public track record (defensive).
  // #TENNIS-VOID-FIX-1: 'unresolved' = the settlement source never returned a
  // result (e.g. a tennis pick that aged out of the window). It is settled only
  // to clear the live board — it is NOT a confirmed outcome, so it must stay out
  // of the track record entirely (list + win-rate + void count alike).
  // #TRACKREC-REAL-0626: paper/shadow picks (signal_type='paper', is_paper=TRUE)
  // are the model's tracked-but-never-published predictions. They must NEVER enter
  // the public track record — only real surfaced signals count. Defensive, like is_demo.
  const conditions: string[] = [
    "is_historical = TRUE",
    "is_demo = FALSE",
    "is_paper = FALSE",
    "result IS DISTINCT FROM 'unresolved'",
  ];
  const values: unknown[] = [];

  if (sport && sport !== "all") {
    values.push(sport);
    conditions.push(`sport = $${values.length}`);
  }
  if (competition && competition !== "all") {
    values.push(`%${competition}%`);
    conditions.push(`competition ILIKE $${values.length}`);
  }
  if (year && /^\d{4}$/.test(year)) {
    values.push(Number(year));
    conditions.push(`EXTRACT(YEAR FROM starts_at) = $${values.length}`);
  }

  // #TRACKREC-REAL-0626: the public win-rate is an ALL-TIME track record, not a
  // recent window — so stats/segments must be computed over every real settled
  // signal, while `limit` only bounds the displayed pick-log list. We fetch up to
  // STATS_CAP rows for the aggregates and slice the list afterwards. Cap is a
  // defensive backstop (real surfaced signals ~75 today); raise it (or move the
  // aggregates into SQL COUNTs) if real settled signals ever approach it.
  const STATS_CAP = 5000;
  const fetched = await dbQuery<HistoryRow>(
    `SELECT id, sport, competition, event_name, home_team, away_team,
            player_one, player_two, market, pick, status,
            result, signal_type, is_paper, is_verified, is_demo,
            starts_at, settled_at, notes, world_cup_stage, group_name,
            confidence_score
     FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY COALESCE(settled_at, starts_at) DESC
     LIMIT ${STATS_CAP}`,
    values
  );

  // SHOWN-PICKS-ONLY track record (#WINRATE-FLOOR-1 → #TRACKREC-REAL-0626). The
  // board suppresses below-floor rows as "no clear favourite" (no directional
  // pick), so the public hit-rate must measure ONLY the picks we actually showed
  // — counting a match where we declined to pick as a "loss" understated it.
  // We now read the board's PERSISTED verdict (wasShownAsPick) rather than
  // re-deriving the floor, so the metric matches exactly what was displayed and
  // is stable across floor changes. Probability-neutral.
  const rows = fetched.filter(wasShownAsPick);

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
  // Stats/segments below run over ALL surfaced real rows; the displayed list is
  // capped to `limit` (the pick-log paginates) — #TRACKREC-REAL-0626.
  const history = rows.slice(0, limit).map((row) => {
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

  // Aggregati opzionali (solo se richiesti) — calcolati sulle stesse righe surfaced.
  const extra: Record<string, unknown> = {};
  const aggRows = rows.map((r) => ({
    sport: r.sport, competition: r.competition, result: r.result, starts_at: String(r.starts_at),
  }));
  if (aggregate.includes("segments")) extra.segments = bySegment(aggRows);

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
    ...extra,
  });
}
