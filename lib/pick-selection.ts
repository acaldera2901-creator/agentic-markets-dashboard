// #PICK-FAVOURITE-0812 — the served directional pick is the BLEND FAVOURITE
// (argmax of the served probability triple), the same outcome the surfacing
// gate measures (confidence_score = max-prob) and the track record settles.
//
// It replaces the previous argmax-EDGE selection. On blended probabilities the
// edge is α·(model − market): its sign per outcome is model noise, and on
// short-history leagues the model systematically overrates longshots, so the
// max edge lands on the underdog. Measured on the live board (2026-08-12):
// 25 of the 26 rows with a favourite ≥56% carried a selection on a different
// outcome, at prices up to 9.0 (e.g. Rangers 66% home → selection AWAY @9.00).
// Had any of those rows cleared its floor, the card, Best Bets, Match Builder,
// unified history and settlement would all have shipped the longshot as "the
// pick" while the card header showed the favourite's confidence.
//
// The favourite's own edge vs the de-vigged price is kept as an informative
// field (it can be negative — the blend tilts toward the line, so true edge
// over the close ≈ 0 by construction; see MARKET_BLEND_ALPHA note in the
// predictions route). It is NOT the selection criterion.

export type FootballSelection = "HOME" | "DRAW" | "AWAY";

export type FavouritePick = {
  selection: FootballSelection;
  // Edge of the SELECTED outcome vs its de-vigged implied probability,
  // rounded to 4 decimals. null when any of the three odds is missing.
  edge: number | null;
};

export function favouritePick(
  pHome: number,
  pDraw: number,
  pAway: number,
  oddsHome?: number | null,
  oddsDraw?: number | null,
  oddsAway?: number | null
): FavouritePick {
  const pMax = Math.max(pHome, pDraw, pAway);
  const selection: FootballSelection =
    pMax === pHome ? "HOME" : pMax === pDraw ? "DRAW" : "AWAY";

  const odds =
    selection === "HOME" ? oddsHome : selection === "DRAW" ? oddsDraw : oddsAway;
  const edge =
    oddsHome != null && oddsDraw != null && oddsAway != null && odds != null && odds > 1
      ? Math.round((pMax - 1 / odds) * 10_000) / 10_000
      : null;

  return { selection, edge };
}
