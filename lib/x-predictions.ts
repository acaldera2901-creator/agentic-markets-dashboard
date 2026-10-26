// lib/x-predictions.ts — #X-PIPELINE-0810 · unified_predictions → XPrediction.
//
// This module decides WHICH rows are allowed to become a public post, and it is
// deliberately strict. It was written against the real served rows of 2026-08-10,
// and every rule below exists because the naive mapping produced a wrong number
// on that day's data:
//
//   row                                       pick     conf  market   naive output
//   Alexandra Eala v Belinda Bencic           null     53    ML       "Eala 53%"   ← guessed the side
//   Västerås SK v Djurgardens IF              null     22    1X2      "Västerås 22%" ← 22% is not a favourite
//   IK Sirius v IF Brommapojkarna             AWAY     12    1X2      "Sirius 88%"  ← FABRICATED: 1X2 has a draw
//   IK Sirius v IF Brommapojkarna (again)     AWAY     13    1X2      duplicate fixture, listed twice
//
// The three rules that follow from it:
//   1. `confidence_score` is the probability OF THE PICK, not of the favourite.
//      With `pick` NULL there is no way to know which side it describes — the row
//      is dropped, never defaulted to the home side.
//   2. A complement (100 − p) is only valid in a TWO-WAY market. In 1X2 the draw
//      absorbs the rest, so p(away)=12% says nothing about p(home). A 1X2 row is
//      usable only when the pick's own probability is already above 50%, which
//      makes it the most likely outcome by construction.
//   3. Two pipelines write this table, so the same fixture appears twice with
//      slightly different numbers. Deduplicated on sport+kickoff+home, keeping the
//      first row — otherwise the "Top 5" lists one match twice.
//
// Every dropped row is COUNTED and returned. A mapper that silently discards most
// of its input looks exactly like a quiet day (the 77.5% of PandaScore maps lost
// in silence is the precedent), so the caller always gets the funnel.

import type { XPrediction } from "./x-posts";

/** The subset of unified_predictions this mapper reads. */
export type UnifiedRowForX = {
  id: string | number;
  sport: string;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  player_one: string | null;
  player_two: string | null;
  market: string | null;
  pick: string | null;
  confidence_score: number | null;
  odds: number | null;
  starts_at: string;
  /** JSON string; the 1/X/2 split lives here, not in columns, on this table. */
  notes: string | null;
};

export type DropReason =
  | "no_team_names"
  | "no_kickoff"
  | "no_confidence"
  | "no_pick_side"
  | "three_way_pick_below_50"
  | "duplicate_fixture";

export type MapReport = {
  predictions: XPrediction[];
  /** Count per reason, for the rows that did NOT make it. */
  dropped: Record<DropReason, number>;
  rowsIn: number;
};

const TWO_WAY_MARKETS = new Set(["ml", "h2h", "moneyline", "winner", "match_winner"]);

function emptyDropped(): Record<DropReason, number> {
  return {
    no_team_names: 0,
    no_kickoff: 0,
    no_confidence: 0,
    no_pick_side: 0,
    three_way_pick_below_50: 0,
    duplicate_fixture: 0,
  };
}

function asPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v <= 1 ? v * 100 : v;
}

/** The 1/X/2 split, if `notes` carries it. Returns null unless it is complete. */
function splitFromNotes(notes: string | null): { home: number; draw: number | null; away: number } | null {
  if (!notes) return null;
  try {
    const n = JSON.parse(notes);
    const home = asPct(typeof n?.p_home === "number" ? n.p_home : null);
    const away = asPct(typeof n?.p_away === "number" ? n.p_away : null);
    if (home == null || away == null) return null;
    return { home, draw: asPct(typeof n?.p_draw === "number" ? n.p_draw : null), away };
  } catch {
    return null;
  }
}

function isTwoWay(row: UnifiedRowForX): boolean {
  const market = (row.market ?? "").trim().toLowerCase();
  if (TWO_WAY_MARKETS.has(market)) return true;
  // A tennis match has no draw whatever the market string says.
  return row.sport.toLowerCase().includes("tennis");
}

type Mapped = { prediction: XPrediction } | { drop: DropReason };

export function mapRow(row: UnifiedRowForX): Mapped {
  const home = row.home_team ?? row.player_one;
  const away = row.away_team ?? row.player_two;
  if (!home || !away) return { drop: "no_team_names" };
  if (!row.starts_at || Number.isNaN(new Date(row.starts_at).getTime())) {
    return { drop: "no_kickoff" };
  }

  const base = {
    id: String(row.id),
    sport: row.sport,
    competition: row.competition ?? row.sport,
    home,
    away,
    startsAtUtc: new Date(row.starts_at).toISOString(),
  };

  // Rule 0 — a real 1/X/2 split beats everything: the favourite is the argmax and
  // its probability is a fact, not an inference from a pick.
  const split = splitFromNotes(row.notes);
  if (split) {
    const sides: Array<[string, number]> = [
      [home, split.home],
      [away, split.away],
    ];
    if (split.draw != null) sides.push(["Draw", split.draw]);
    const [favorite, modelPct] = sides.reduce((a, b) => (b[1] > a[1] ? b : a));
    // The market price refers to the PICK: usable only if the pick is that side.
    const pickSide = resolvePickSide(row, home, away);
    const marketPct = pickSide === favorite ? impliedPct(row.odds) : null;
    return {
      prediction: {
        ...base,
        favorite,
        modelPct,
        marketPct,
        edgePct: marketPct != null ? modelPct - marketPct : null,
      },
    };
  }

  const pickPct = asPct(row.confidence_score);
  if (pickPct == null) return { drop: "no_confidence" };

  const pickSide = resolvePickSide(row, home, away);
  if (!pickSide) return { drop: "no_pick_side" };

  let favorite = pickSide;
  let modelPct = pickPct;
  let marketPct = impliedPct(row.odds);

  if (pickPct < 50) {
    if (!isTwoWay(row) || pickSide === "Draw") return { drop: "three_way_pick_below_50" };
    // Two-way: the complement is the other side's probability, and it is the
    // favourite. The market price described the OTHER side, so it is dropped —
    // 100 − implied(pick) is not the opponent's implied probability once the
    // bookmaker's overround is in the number.
    favorite = pickSide === home ? away : home;
    modelPct = 100 - pickPct;
    marketPct = null;
  }

  return {
    prediction: {
      ...base,
      favorite,
      modelPct,
      marketPct,
      edgePct: marketPct != null ? modelPct - marketPct : null,
    },
  };
}

function resolvePickSide(row: UnifiedRowForX, home: string, away: string): string | null {
  const pick = (row.pick ?? "").trim();
  if (!pick) return null;
  const upper = pick.toUpperCase();
  if (upper === "HOME") return home;
  if (upper === "AWAY") return away;
  if (upper === "DRAW") return "Draw";
  return pick;
}

function impliedPct(odds: number | null): number | null {
  return odds != null && odds > 1 ? 100 / odds : null;
}

/** Fixture identity for dedup: the same match written by two pipelines. */
function fixtureKey(row: UnifiedRowForX): string {
  const home = (row.home_team ?? row.player_one ?? "").trim().toLowerCase();
  return `${row.sport.toLowerCase()}|${new Date(row.starts_at).toISOString()}|${home}`;
}

/** Map a day of rows, keeping the funnel of what was dropped and why. */
export function mapRows(rows: UnifiedRowForX[]): MapReport {
  const dropped = emptyDropped();
  const predictions: XPrediction[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = fixtureKey(row);
    if (seen.has(key)) {
      dropped.duplicate_fixture++;
      continue;
    }
    const result = mapRow(row);
    if ("drop" in result) {
      dropped[result.drop]++;
      continue;
    }
    seen.add(key);
    predictions.push(result.prediction);
  }

  return { predictions, dropped, rowsIn: rows.length };
}
