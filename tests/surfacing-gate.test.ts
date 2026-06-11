import assert from "node:assert/strict";
import {
  SURFACE_FLOOR_FOOTBALL,
  SURFACE_FLOOR_FRIENDLY,
  SURFACE_FLOOR_TENNIS,
  surfaceDecision,
  surfaceFloorFor,
  isSurfacedRow,
} from "../lib/surfacing-gate";

// ── Single source of truth ──────────────────────────────────────────────────
// Must mirror config/settings.py SURFACE_FLOOR_* . If the Python floors move,
// these constants and assertions move with them.
assert.equal(SURFACE_FLOOR_FOOTBALL, 56);
assert.equal(SURFACE_FLOOR_FRIENDLY, 61);
assert.equal(SURFACE_FLOOR_TENNIS, 62);

// ── Boundary: club football floor (inclusive) ────────────────────────────────
{
  const below = surfaceDecision(55);
  assert.equal(below.isPick, false);
  assert.equal(below.belowFloor, true);

  const at = surfaceDecision(56);
  assert.equal(at.isPick, true);
  assert.equal(at.belowFloor, false);
}

// ── Well below / well above ───────────────────────────────────────────────────
{
  assert.equal(surfaceDecision(40).belowFloor, true);
  assert.equal(surfaceDecision(80).belowFloor, false);
}

// ── isPick and belowFloor are exact complements ───────────────────────────────
{
  for (const c of [10, 55, 56, 70, 99]) {
    const d = surfaceDecision(c);
    assert.equal(d.isPick, !d.belowFloor, `complement broken at ${c}`);
  }
}

// ── surfaceFloorFor: per-segment floor resolution ────────────────────────────
{
  assert.equal(surfaceFloorFor("football", "Premier League"), 56);
  assert.equal(surfaceFloorFor("football", "World Cup"), 56);
  assert.equal(surfaceFloorFor("football", "International Friendly"), 61);
  assert.equal(surfaceFloorFor("Tennis", "Libéma Open"), 62); // case-insensitive
  assert.equal(surfaceFloorFor(null, null), 56); // fail-soft default
}

// ── isSurfacedRow: only above-floor picks count toward the public hit-rate ────
{
  // Friendly: 60 below 61 → not surfaced; 61 at floor → surfaced.
  assert.equal(isSurfacedRow({ sport: "football", competition: "International Friendly", confidence_score: 60 }), false);
  assert.equal(isSurfacedRow({ sport: "football", competition: "International Friendly", confidence_score: 61 }), true);
  // Club football: floor 56.
  assert.equal(isSurfacedRow({ sport: "football", competition: "Serie A", confidence_score: 55 }), false);
  assert.equal(isSurfacedRow({ sport: "football", competition: "Serie A", confidence_score: 56 }), true);
  // Tennis: floor 62.
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "ATP", confidence_score: 61 }), false);
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "ATP", confidence_score: 62 }), true);
  // Null confidence → fail-closed (cannot prove it was surfaced).
  assert.equal(isSurfacedRow({ sport: "football", competition: "International Friendly", confidence_score: null }), false);
}

console.log("surfacing gate ok");
