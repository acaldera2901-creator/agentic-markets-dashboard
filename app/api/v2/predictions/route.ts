import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";
import { pickOfDayId } from "@/lib/pick-of-day";
import { withAffiliate } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req); // never denies (read)

  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const status      = searchParams.get("status");

  const conditions: string[] = [
    "starts_at > NOW()",
    "expires_at > NOW()",
    "published_at IS NOT NULL",
    "is_historical = FALSE",
  ];

  if (sport && sport !== "all") {
    conditions.push(`sport = '${sport.replace(/'/g, "''")}'`);
  }
  if (competition && competition !== "all") {
    conditions.push(`competition ILIKE '%${competition.replace(/'/g, "''")}%'`);
  }
  if (status && status !== "all") {
    conditions.push(`status = '${status.replace(/'/g, "''")}'`);
  }

  const rows = await dbQuery<UnifiedPrediction>(
    `SELECT * FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       competition = 'World Cup' DESC,
       starts_at ASC
     LIMIT 100`
  );

  const potd = pickOfDayId(rows as Array<{ id: string; confidence_score?: number | null; starts_at?: string | null }>);
  const predictions = rows.map((row) => {
    const projected = projectPrediction(row as unknown as Record<string, unknown>, state, (row as { id: string }).id === potd);
    return projected.locked ? projected : withAffiliate(projected);
  });

  return NextResponse.json(
    {
      predictions,
      meta: {
        source: "database",
        generated_at: new Date().toISOString(),
        count: predictions.length,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } }
  );
}
