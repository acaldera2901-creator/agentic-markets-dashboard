import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";
import { pickOfDayId } from "@/lib/pick-of-day";
import { withAffiliate } from "@/lib/affiliate";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req); // never denies (read)

  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const status      = searchParams.get("status");

  // Demo rows must never reach the public board (defensive, AM-CODE-REVIEW-001 #4).
  // Rolling publication window (#019): serve only the next N days — closer
  // matches carry more information; distant ones come into view day by day.
  const conditions: string[] = [
    // #LIVE-1: le card restano servite durante il match (150 min ≈ 90' +
    // recuperi + margine) e spariscono quando il settlement le sposta in
    // history — stessa finestra del board principale.
    "starts_at > NOW() - interval '150 minutes'",
    "starts_at < NOW() + ($1 || ' days')::interval",
    "expires_at > NOW() - interval '150 minutes'",
    "published_at IS NOT NULL",
    "is_historical = FALSE",
    "is_demo = FALSE",
  ];
  const values: unknown[] = [PREDICTION_WINDOW_DAYS];

  if (sport && sport !== "all") {
    values.push(sport);
    conditions.push(`sport = $${values.length}`);
  }
  if (competition && competition !== "all") {
    values.push(`%${competition}%`);
    conditions.push(`competition ILIKE $${values.length}`);
  }
  if (status && status !== "all") {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const rows = await dbQuery<UnifiedPrediction>(
    `SELECT * FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       competition = 'World Cup' DESC,
       starts_at ASC
     LIMIT 100`,
    values
  );

  // Friendly / WC paper rows store the 1X2 distribution in `notes` (JSON), not
  // in the p_home/p_draw/p_away columns (which stay null). Without this coalesce
  // a consumer reading the p_* columns gets null → the board's "leader"
  // computation falls through to AWAY while the row's `pick` says HOME, so the
  // shown favourite flickers (e.g. Kosovo↔Andorra). /api/predictions already
  // parses notes (unifiedToPredictionRow); mirror it here so both boards agree.
  for (const r of rows as unknown as Array<{ p_home: number | null; p_draw: number | null; p_away: number | null; notes: string | null }>) {
    if (r.p_home == null && r.notes) {
      try {
        const n = JSON.parse(r.notes);
        if (typeof n?.p_home === "number") {
          r.p_home = n.p_home;
          r.p_draw = typeof n.p_draw === "number" ? n.p_draw : null;
          r.p_away = typeof n.p_away === "number" ? n.p_away : null;
        }
      } catch {
        // malformed notes → leave columns null (fail-soft, never fabricate)
      }
    }
  }

  const potd = pickOfDayId(rows as Array<{ id: string; confidence_score?: number | null; starts_at?: string | null }>);
  const predictions = rows.map((row) => {
    const projected = projectPrediction(row as unknown as Record<string, unknown>, state, (row as { id: string }).id === potd);
    return projected.locked ? projected : withAffiliate(projected);
  });

  // Access bug fix (2026-06-06): this route projects per-session
  // (lib/access-projection.ts), so the body differs for anonymous vs
  // logged-in viewers. A shared `public, s-maxage` header let Vercel's CDN
  // cache one viewer's projection (e.g. an unlocked logged-in response) under
  // the URL key and serve it to everyone — a logged-in user could see the
  // anonymous blurred board, or worse, an anonymous user could see unlocked
  // picks. Only the anonymous projection is identical across requests and safe
  // to share-cache; any session gets `private, no-store`.
  const cacheControl =
    state === "anonymous"
      ? "public, s-maxage=120, stale-while-revalidate=60"
      : "private, no-store";

  return NextResponse.json(
    {
      predictions,
      meta: {
        source: "database",
        generated_at: new Date().toISOString(),
        count: predictions.length,
      },
    },
    { headers: { "Cache-Control": cacheControl, Vary: "Cookie" } }
  );
}
