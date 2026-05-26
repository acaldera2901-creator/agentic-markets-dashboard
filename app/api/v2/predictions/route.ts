import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction, applyAccessControl } from "@/lib/unified-adapter";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const status      = searchParams.get("status");
  const planAccess  = searchParams.get("plan_access") ?? "public";

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

  const predictions = rows.map((row) => applyAccessControl(row, planAccess));

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
