// GET /api/world-cup/squads — public, read-only, from the Track A tables
// (wc_squads / wc_squad_players / wc_squad_snapshots).
//   ?team=<name or slug>  → one roster + the reveal timeline (added/removed/
//                           injury changes per snapshot) — the convocazioni data.
//   (no param)            → 48-team summary (squad size, injured count, last update).
// Parametrized SQL only, no money fields, history capped to the last 20 reveals.
import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { teamNeedleFromSlug } from "@/lib/world-cup";

const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" };

type SquadRow = {
  id: string;
  team_canonical: string;
  squad_size: number | null;
  injured_count: number | null;
  source: string;
  updated_at: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get("team");

  if (!team) {
    const squads = await dbQuery<SquadRow>(
      `SELECT id, team_canonical, squad_size, injured_count, source, updated_at
       FROM wc_squads ORDER BY team_canonical ASC`
    );
    return NextResponse.json(
      { squads, meta: { generated_at: new Date().toISOString(), count: squads.length } },
      { headers: CACHE }
    );
  }

  // slug ("south-korea"), display ("South Korea") and ESPN variants
  // ("czechia", "cape-verde") all resolve to the canonical row.
  const needle = teamNeedleFromSlug(team.replace(/\s+/g, "-"));
  const squads = await dbQuery<SquadRow>(
    `SELECT id, team_canonical, squad_size, injured_count, source, updated_at
     FROM wc_squads WHERE team_canonical ILIKE $1 LIMIT 1`,
    [needle]
  );
  const squad = squads[0];
  if (!squad) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }

  const [players, snapshots] = await Promise.all([
    dbQuery<{ player_name: string; position: string | null; is_injured: boolean; shirt_number: number | null; club_team: string | null; age: number | null }>(
      `SELECT player_name, position, is_injured, shirt_number, club_team, age
       FROM wc_squad_players WHERE squad_id = $1
       ORDER BY position ASC NULLS LAST, player_name ASC`,
      [squad.id]
    ),
    dbQuery<{ captured_at: string; diff: unknown }>(
      `SELECT captured_at, diff FROM wc_squad_snapshots
       WHERE team_canonical = $1 ORDER BY captured_at DESC LIMIT 20`,
      [squad.team_canonical]
    ),
  ]);

  return NextResponse.json(
    {
      team: squad.team_canonical,
      squad_size: squad.squad_size,
      injured_count: squad.injured_count,
      source: squad.source,
      updated_at: squad.updated_at,
      players,
      // reveal timeline, newest first; diff NULL = first capture
      timeline: snapshots,
      meta: { generated_at: new Date().toISOString() },
    },
    { headers: CACHE }
  );
}
