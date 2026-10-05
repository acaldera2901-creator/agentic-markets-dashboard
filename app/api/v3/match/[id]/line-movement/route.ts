import { NextRequest, NextResponse } from "next/server";
import { footballPairKey } from "@/lib/v3c/board";
import type { V3LineMovementResponse } from "@/lib/v3c/contracts";
import { v3Allowed } from "@/lib/v3c/guard";
import { ahSeries, partnerSeries } from "@/lib/v3c/line-movement";
import { fetchAhHistory, fetchMatchFixture, fetchPartnerHistory } from "@/lib/v3c/queries";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3LineMovementResponse (lib/v3c/contracts.ts).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await ctx.params;
  const matchId = decodeURIComponent(id);
  if (!matchId || matchId.length > 200) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const fixture = await fetchMatchFixture(matchId);
    if (!fixture) return NextResponse.json({ error: "unknown match" }, { status: 404 });
    const key = footballPairKey(fixture);
    const [partner, ah] = key ? await Promise.all([fetchPartnerHistory(key), fetchAhHistory(key)]) : [[], []];
    const series = [...partnerSeries(fixture, partner), ...ahSeries(fixture, ah)];
    const body: V3LineMovementResponse = {
      contract: "v3.line_movement.1",
      generated_at: new Date().toISOString(),
      match: {
        id: matchId,
        home: fixture.home,
        away: fixture.away,
        kickoff: new Date(fixture.kickoff).toISOString(),
        team_pair_key: key,
      },
      series,
      notes: [
        "Every stored capture is returned; nothing is interpolated or smoothed. The first point is the first capture we hold, not necessarily the book's opening price.",
        "coverage.median_interval_min is the measured capture frequency of each series.",
        "1X2 series: feed books only (partner_price_history). AH series: ah_odds_history, line quoted for the home side.",
        series.length === 0 ? "No stored price history for this match." : "",
      ].filter(Boolean),
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[v3/line-movement]", String(e));
    return NextResponse.json({ error: "line movement unavailable" }, { status: 503 });
  }
}
