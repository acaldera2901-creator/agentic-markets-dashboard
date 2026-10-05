import { NextRequest, NextResponse } from "next/server";
import { footballPairKey } from "@/lib/v3c/board";
import type { V3LineMovementResponse } from "@/lib/v3c/contracts";
import { v3Allowed } from "@/lib/v3c/guard";
import { ahSeries, partnerSeries } from "@/lib/v3c/line-movement";
import { fetchAhHistory, fetchMatchFixture, fetchPartnerHistory, fetchTennisFixture } from "@/lib/v3c/queries";
import { tennisMlSeries, tennisPairKey } from "@/lib/v3c/tennis";

export const dynamic = "force-dynamic";

// Read-only. Contract: V3LineMovementResponse (lib/v3c/contracts.ts).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await v3Allowed(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await ctx.params;
  const matchId = decodeURIComponent(id);
  if (!matchId || matchId.length > 200) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    // Tennis ids are tennis_predictions.match_id («tennis:…»); everything else is football.
    const isTennis = matchId.startsWith("tennis:");
    const fixture = isTennis ? await fetchTennisFixture(matchId) : await fetchMatchFixture(matchId);
    if (!fixture) return NextResponse.json({ error: "unknown match" }, { status: 404 });
    let key: string | null;
    let series;
    if (isTennis) {
      key = tennisPairKey({ id: matchId, player1: fixture.home, player2: fixture.away, kickoff: fixture.kickoff });
      series = tennisMlSeries(fixture, key ? await fetchPartnerHistory(key) : []);
    } else {
      key = footballPairKey(fixture);
      const [partner, ah] = key ? await Promise.all([fetchPartnerHistory(key), fetchAhHistory(key)]) : [[], []];
      series = [...partnerSeries(fixture, partner), ...ahSeries(fixture, ah)];
    }
    const body: V3LineMovementResponse = {
      contract: "v3.line_movement.2",
      generated_at: new Date().toISOString(),
      match: {
        id: matchId,
        sport: isTennis ? "tennis" : "football",
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
        "Tennis (ML series): feed books only (partner_price_history), p1/p2 = our player1/player2, market_p de-vigged on the 2-way price. No AH for tennis.",
        series.length === 0 ? "No stored price history for this match." : "",
      ].filter(Boolean),
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[v3/line-movement]", String(e));
    return NextResponse.json({ error: "line movement unavailable" }, { status: 503 });
  }
}
