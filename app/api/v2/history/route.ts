import { NextResponse } from "next/server";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";
import { readHistorySnapshot } from "@/lib/history-snapshot";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {

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

  const [{ state }, snapshot] = await Promise.all([
    resolveAccessState(req),
    readHistorySnapshot({
      sport: sport && sport !== "all" ? sport : null,
      competition: competition && competition !== "all" ? competition : null,
      year: year && /^\d{4}$/.test(year) ? year : null,
    }),
  ]);

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
  const history = snapshot.rows.slice(0, limit).map((row) => {
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

  return NextResponse.json({
    history,
    stats: snapshot.stats,
    ...(aggregate.includes("segments") ? { segments: snapshot.segments } : {}),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
