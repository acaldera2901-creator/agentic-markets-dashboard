import assert from "node:assert/strict";
import { tennisPredictionToUnifiedInsert } from "../lib/tennis-adapter";
import {
  SURFACE_FLOOR_TENNIS,
  SURFACE_FLOOR_TENNIS_LO,
  SURFACE_FLOOR_TENNIS_LO_GRASS,
} from "../lib/surfacing-gate";

// #FLOOR-UNIFORM-1 (APPROVE Andrea 2026-06-09): the tennis confidence-surfacing
// floor must be enforced in the unified sync too, not only on the board route.
// Below the floor there is no clear favourite → the published row carries NO
// directional pick (pick=null), while probabilities/confidence stay untouched
// (probability-neutral). This stops sub-floor picks leaking onto v2 / Match
// Builder / Creator Picks.
// #TENNIS-SEG-FLOOR-1 (lab 2026-06-11): the floor is segment-aware by
// tournament name — hi tier 62, lower tiers 64, lower tiers on grass 66.

function row(
  p1: number,
  p2: number,
  best: "P1" | "P2",
  tournament = "Test Open"
): Parameters<typeof tennisPredictionToUnifiedInsert>[0] {
  return {
    match_id: "m1", tournament, surface: "hard",
    player1: "Alice", player2: "Bob",
    scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
    p1, p2, odds_p1: null, odds_p2: null, edge: null, best_selection: best,
    model_version: "test", serve_form_p1: null, serve_form_p2: null,
    return_form_p1: null, return_form_p2: null, feature_quality: null,
  };
}

// ── HI tier (Slam): floor 62, inclusive ───────────────────────────────────────
{
  const below = tennisPredictionToUnifiedInsert(row(0.61, 0.39, "P1", "Wimbledon"));
  assert.equal(below.pick, null, "hi-tier below-floor pick must be null");
  assert.equal(below.confidence_score, 61, "confidence is probability-neutral (unchanged)");

  const at = tennisPredictionToUnifiedInsert(row(0.62, 0.38, "P1", "Wimbledon"));
  assert.equal(at.pick, "Alice", "hi-tier at-floor pick must be the picked player");
}

// ── LOWER tier (unknown name fails closed here): floor 64 ─────────────────────
{
  const below = tennisPredictionToUnifiedInsert(row(0.63, 0.37, "P1")); // Test Open → lo
  assert.equal(below.pick, null, "lower-tier conf 63 must not surface a pick");
  assert.equal(below.confidence_score, 63, "confidence unchanged (probability-neutral)");

  const at = tennisPredictionToUnifiedInsert(row(0.64, 0.36, "P1"));
  assert.equal(at.pick, "Alice", "lower-tier at-floor (64) pick must be published");
}

// ── LOWER tier on GRASS (the June swing): floor 66 ────────────────────────────
{
  const below = tennisPredictionToUnifiedInsert(row(0.35, 0.65, "P2", "Libéma Open"));
  assert.equal(below.pick, null, "lo-grass conf 65 must not surface a pick");

  const at = tennisPredictionToUnifiedInsert(row(0.34, 0.66, "P2", "Libéma Open"));
  assert.equal(at.pick, "Bob", "lo-grass at-floor (66) pick must be published");
}

// ── Floor constants mirror config/settings.py ─────────────────────────────────
assert.equal(SURFACE_FLOOR_TENNIS, 62);
assert.equal(SURFACE_FLOOR_TENNIS_LO, 64);
assert.equal(SURFACE_FLOOR_TENNIS_LO_GRASS, 66);

console.log("tennis adapter floor ok");
