// GET /api/world-cup/fixtures — public, read-only. The full 104-match
// calendar (kickoff, venue, group, stage, live score once started), proxied
// from ESPN (free) and cached. Optional filters: ?stage=group&group=A&team=Italy.
// No money fields, no gated data.
import { NextResponse } from "next/server";
import { fetchWcFixtures } from "@/lib/world-cup";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const group = searchParams.get("group");
  const team = searchParams.get("team")?.toLowerCase();

  let fixtures = await fetchWcFixtures();
  if (stage) fixtures = fixtures.filter((f) => f.stage === stage);
  if (group) fixtures = fixtures.filter((f) => f.group?.toLowerCase() === group.toLowerCase());
  if (team) {
    fixtures = fixtures.filter(
      (f) => f.home_team.toLowerCase().includes(team) || f.away_team.toLowerCase().includes(team)
    );
  }

  return NextResponse.json(
    {
      fixtures,
      meta: {
        source: "espn",
        generated_at: new Date().toISOString(),
        count: fixtures.length,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } }
  );
}
