import assert from "node:assert/strict";
import { tennisPredictionToUnifiedInsert } from "../lib/tennis-adapter";
import { SURFACE_FLOOR_TENNIS } from "../lib/surfacing-gate";

// #FLOOR-UNIFORM-1 (APPROVE Andrea 2026-06-09): the tennis confidence-surfacing
// floor must be enforced in the unified sync too, not only on the board route.
// Below the floor there is no clear favourite → the published row carries NO
// directional pick (pick=null), while probabilities/confidence stay untouched
// (probability-neutral). This stops sub-floor picks leaking onto v2 / Match
// Builder / Creator Picks.

function row(p1: number, p2: number, best: "P1" | "P2"): Parameters<typeof tennisPredictionToUnifiedInsert>[0] {
  return {
    match_id: "m1", tournament: "Test Open", surface: "hard",
    player1: "Alice", player2: "Bob",
    scheduled_at: new Date(Date.now() + 3_600_000).toISOString(),
    p1, p2, odds_p1: null, odds_p2: null, edge: null, best_selection: best,
    model_version: "test", serve_form_p1: null, serve_form_p2: null,
    return_form_p1: null, return_form_p2: null, feature_quality: null,
  };
}

// ── Below floor: no directional pick is published ────────────────────────────
{
  const d = tennisPredictionToUnifiedInsert(row(0.61, 0.39, "P1")); // conf 61 < 62
  assert.equal(d.pick, null, "below-floor pick must be null");
  assert.equal(d.confidence_score, 61, "confidence is probability-neutral (unchanged)");
}

// ── At the floor (inclusive): pick is published ──────────────────────────────
{
  const d = tennisPredictionToUnifiedInsert(row(0.62, 0.38, "P1")); // conf 62 == floor
  assert.equal(d.pick, "Alice", "at-floor pick must be the picked player");
}

// ── Above floor: pick is published, picked side honoured ─────────────────────
{
  const d = tennisPredictionToUnifiedInsert(row(0.34, 0.66, "P2")); // conf 66
  assert.equal(d.pick, "Bob");
}

// ── Floor constant is the tennis one (mirrors config/settings.py) ────────────
assert.equal(SURFACE_FLOOR_TENNIS, 62);

console.log("tennis adapter floor ok");
