import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";
import type { AccessState } from "@/lib/auth";
import { isUnlocked } from "@/lib/access-projection";
import { surfaceDecision, surfaceFloorFor } from "@/lib/surfacing-gate";

export const dynamic = "force-dynamic";

// #NEWSPORTS (Gate 1 lab 2026-07-04/05, docs/NEWSPORTS-INTEGRATION.md) — serves
// baseball (MLB) and MMA (UFC) rows from unified_predictions. DARK by default:
// without NEWSPORT_SERVE_ENABLED="true" this route returns an empty board and
// touches nothing. Both sports are 2-outcome; the served probability is the
// devigged market probability written by the ingestion module — this route is
// probability-neutral like the tennis/football paths (the gate only decides
// whether the directional pick is shown).

type UnifiedNewsportRow = {
  id: string;
  sport: string; // "baseball" | "mma"
  league: string | null;
  competition: string;
  home_team: string | null; // MLB: home team · MMA: fighter A (prod convention:
  away_team: string | null; //   the home/away slots carry both-sport sides)
  starts_at: string;
  pick: string | null;
  notes: string | null; // JSON: { p_home, p_away, odds_home, odds_away, mkt_source, n_books }
  confidence_score: number | null;
  enrichment: Record<string, unknown> | null;
  updated_at: string;
};

type NewsportMatch = {
  id: string;
  sport: string;
  league: string | null;
  competition: string;
  side_a: string;
  side_b: string;
  scheduled: string;
  p_a: number;
  p_b: number;
  odds_a: number | null;
  odds_b: number | null;
  confidence_score: number;
  enrichment: Record<string, unknown> | null;
};

function toMatch(u: UnifiedNewsportRow): NewsportMatch | null {
  if (!u.home_team || !u.away_team) return null;
  let notes: {
    p_home?: unknown;
    p_away?: unknown;
    odds_home?: unknown;
    odds_away?: unknown;
  };
  try {
    notes = JSON.parse(u.notes ?? "");
  } catch {
    return null; // rows without the distribution: skip, never invent numbers
  }
  const pA = Number(notes?.p_home);
  const pB = Number(notes?.p_away);
  if (!Number.isFinite(pA) || !Number.isFinite(pB)) return null;
  const oddsA = Number(notes?.odds_home);
  const oddsB = Number(notes?.odds_away);
  return {
    id: u.id,
    sport: u.sport,
    league: u.league,
    competition: u.competition,
    side_a: u.home_team,
    side_b: u.away_team,
    scheduled: u.starts_at,
    p_a: pA,
    p_b: pB,
    odds_a: Number.isFinite(oddsA) ? oddsA : null,
    odds_b: Number.isFinite(oddsB) ? oddsB : null,
    confidence_score: u.confidence_score ?? Math.round(Math.max(pA, pB) * 100),
    enrichment: u.enrichment,
  };
}

// Same plan projection as the tennis board (#PLANS-3TIER-1): rank by confidence
// (these picks are market-anchored — no edge claim to rank on), free unlocks the
// top row, base the top 5, premium everything. Locked rows keep the matchup
// visible and blank every number the card would show.
function projectNewsportMatches(matches: NewsportMatch[], state: AccessState) {
  const rankById = new Map<string, number>();
  [...matches]
    .map((m) => ({ id: m.id, conf: m.confidence_score }))
    .sort((a, b) => b.conf - a.conf)
    .forEach((r, i) => rankById.set(r.id, i));
  return matches.map((m) => {
    const rank = rankById.get(m.id) ?? Infinity;
    const isPotD = rank === 0;
    if (isUnlocked(state, rank)) {
      // Confidence-surfacing gate (#NEWSPORTS Gate 1): below the sport floor
      // there is no clear favourite — the directional pick is dropped, the
      // numbers are untouched (probability-neutral).
      const floor = surfaceFloorFor(m.sport, m.competition);
      const { isPick, belowFloor } = surfaceDecision(m.confidence_score, floor);
      return {
        ...m,
        locked: false,
        pick_of_day: isPotD,
        below_floor: belowFloor,
        pick: isPick ? (m.p_a >= m.p_b ? m.side_a : m.side_b) : null,
      };
    }
    return {
      ...m,
      locked: true,
      pick_of_day: isPotD,
      p_a: null,
      p_b: null,
      odds_a: null,
      odds_b: null,
      confidence_score: null,
      enrichment: null,
      below_floor: null,
      pick: null,
    };
  });
}

export async function GET(req: Request) {
  if (process.env.NEWSPORT_SERVE_ENABLED !== "true") {
    // DARK default: board empty, flag reported so the client can hide the tabs.
    return NextResponse.json({ enabled: false, matches: [], computed_at: null });
  }

  const { state } = await resolveAccessState(req); // never denies (read)

  // Same visibility guards as the football unified fallback: the card stays
  // visible while the event runs (MLB game ≈ 3h; MMA card windows are handled
  // upstream by the 2-30h ingestion rule) and disappears once settlement moves
  // it to History. Only published, non-demo, non-historical rows are served.
  const rows = await dbQuery<UnifiedNewsportRow>(
    `SELECT id, sport, league, competition, home_team, away_team,
            starts_at, pick, notes, confidence_score, enrichment, updated_at
     FROM unified_predictions
     WHERE sport IN ('baseball', 'mma')
       AND starts_at > NOW() - interval '240 minutes'
       AND starts_at < NOW() + interval '48 hours'
       AND (expires_at IS NULL OR expires_at > NOW() - interval '240 minutes')
       AND published_at IS NOT NULL
       AND is_historical = FALSE
       AND is_demo = FALSE
     ORDER BY starts_at ASC
     LIMIT 120`
  );

  const matches = rows
    .map(toMatch)
    .filter((m): m is NewsportMatch => m !== null);
  const projected = projectNewsportMatches(matches, state);

  return NextResponse.json({
    enabled: true,
    matches: projected,
    summary: {
      total: matches.length,
      baseball: matches.filter((m) => m.sport === "baseball").length,
      mma: matches.filter((m) => m.sport === "mma").length,
    },
    computed_at: new Date().toISOString(),
  });
}
