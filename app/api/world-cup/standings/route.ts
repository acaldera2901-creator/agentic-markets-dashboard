// GET /api/world-cup/standings — public, read-only. 12 groups (A-L) with
// per-team W/D/L, goals and points, proxied from ESPN (free) and cached.
// Pre-kickoff every row is zeroed by the source itself; once matches settle
// the table populates with no writer of ours involved. No money fields.
import { NextResponse } from "next/server";
import { fetchWcGroups } from "@/lib/world-cup";

export async function GET() {
  const groups = await fetchWcGroups();
  return NextResponse.json(
    {
      groups,
      meta: {
        source: "espn",
        generated_at: new Date().toISOString(),
        count: groups.length,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } }
  );
}
