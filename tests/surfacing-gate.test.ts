import assert from "node:assert/strict";
import {
  SURFACE_FLOOR_FOOTBALL,
  SURFACE_FLOOR_FRIENDLY,
  SURFACE_FLOOR_TENNIS,
  SURFACE_FLOOR_TENNIS_LO,
  SURFACE_FLOOR_TENNIS_LO_GRASS,
  SURFACE_FLOOR_WC,
  surfaceDecision,
  surfaceFloorFor,
  tennisFloorFor,
  isSurfacedRow,
} from "../lib/surfacing-gate";

// ── Single source of truth ──────────────────────────────────────────────────
// Must mirror config/settings.py SURFACE_FLOOR_* . If the Python floors move,
// these constants and assertions move with them.
assert.equal(SURFACE_FLOOR_FOOTBALL, 56);
assert.equal(SURFACE_FLOOR_FRIENDLY, 66);
assert.equal(SURFACE_FLOOR_TENNIS, 62);
assert.equal(SURFACE_FLOOR_TENNIS_LO, 64);
assert.equal(SURFACE_FLOOR_TENNIS_LO_GRASS, 66);
assert.equal(SURFACE_FLOOR_WC, 26);

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
  // #WC-SURFACE-FLOOR: il WC ha il floor dedicato (knockout visibili).
  assert.equal(surfaceFloorFor("football", "World Cup"), 26);
  assert.equal(surfaceFloorFor("football", "FIFA World Cup 2026"), 26);
  assert.equal(surfaceFloorFor("football", "International Friendly"), 66);
  assert.equal(surfaceFloorFor(null, null), 56); // fail-soft default
}

// ── tennisFloorFor: segment-aware tennis floors (#TENNIS-SEG-FLOOR-1) ────────
// Lab 2026-06-11 (19.8k held-out 2023+): hi tiers hold 73-77% at 62; lower
// tiers 69-70% → 64; the weakest cell is low-tier GRASS (June swing) → 66.
{
  // hi tier: Slams / Masters / 1000 / Finals / Olympics keep 62
  assert.equal(tennisFloorFor("Wimbledon"), 62);
  assert.equal(tennisFloorFor("US Open"), 62);
  assert.equal(tennisFloorFor("Cincinnati Open"), 62);
  assert.equal(tennisFloorFor("Mutua Madrid Open"), 62);
  // lower tiers (250/500/WTA minors): 64
  assert.equal(tennisFloorFor("Hamburg Open"), 64);
  assert.equal(tennisFloorFor("Umag Open"), 64);
  // lower tiers on grass (the June swing): 66 — case-insensitive
  assert.equal(tennisFloorFor("Libéma Open"), 66);
  assert.equal(tennisFloorFor("Terra Wortmann Open"), 66);
  assert.equal(tennisFloorFor("EASTBOURNE INTERNATIONAL"), 66);
  // unknown/missing tournament fails CLOSED to the stricter lower tier
  assert.equal(tennisFloorFor(null), 64);
  assert.equal(tennisFloorFor("Mystery Cup"), 64);
  // surfaceFloorFor routes tennis through the segment resolver
  assert.equal(surfaceFloorFor("Tennis", "Libéma Open"), 66);
  assert.equal(surfaceFloorFor("tennis", "Wimbledon"), 62);
}

// ── isSurfacedRow: only above-floor picks count toward the public hit-rate ────
{
  // Friendly: 65 below 66 → not surfaced; 66 at floor → surfaced (#MINORS-TIGHTEN).
  assert.equal(isSurfacedRow({ sport: "football", competition: "International Friendly", confidence_score: 65 }), false);
  assert.equal(isSurfacedRow({ sport: "football", competition: "International Friendly", confidence_score: 66 }), true);
  // Club football: floor 56.
  assert.equal(isSurfacedRow({ sport: "football", competition: "Serie A", confidence_score: 55 }), false);
  assert.equal(isSurfacedRow({ sport: "football", competition: "Serie A", confidence_score: 56 }), true);
  // Tennis hi tier: floor 62.
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "Wimbledon", confidence_score: 61 }), false);
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "Wimbledon", confidence_score: 62 }), true);
  // Tennis lower tier: floor 64 (unknown tournament resolves here, fail-closed).
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "ATP", confidence_score: 63 }), false);
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "ATP", confidence_score: 64 }), true);
  // Tennis lower-tier grass: floor 66.
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "Libéma Open", confidence_score: 65 }), false);
  assert.equal(isSurfacedRow({ sport: "tennis", competition: "Libéma Open", confidence_score: 66 }), true);
  // Null confidence → fail-closed (cannot prove it was surfaced).
  assert.equal(isSurfacedRow({ sport: "football", competition: "International Friendly", confidence_score: null }), false);
}


// ── #SUMMER-LEAGUES-1 (APPROVE Andrea 2026-06-12): per-league club floors ────
{
  // #MINORS-TIGHTEN (Michele 07/07, live data): floors RAISED on minor leagues.
  assert.equal(surfaceFloorFor("football", "Allsvenskan"), 65);
  assert.equal(surfaceFloorFor("football", "League of Ireland"), 70);
  assert.equal(surfaceFloorFor("football", "Chinese Super League"), 70);
  assert.equal(surfaceFloorFor("football", "Veikkausliiga"), 65);
  assert.equal(surfaceFloorFor("football", "Eliteserien"), 60);
  // Case-insensitive substring match on the served competition name.
  assert.equal(surfaceFloorFor("football", "ALLSVENSKAN"), 65);
  // History/hit-rate guard follows the same per-league floor (serving-side).
  assert.equal(isSurfacedRow({ sport: "football", competition: "Allsvenskan", confidence_score: 64 }), false);
  assert.equal(isSurfacedRow({ sport: "football", competition: "Allsvenskan", confidence_score: 65 }), true);
  assert.equal(isSurfacedRow({ sport: "football", competition: "Eliteserien", confidence_score: 60 }), true);
  // WC dedicated floor flows into isSurfacedRow too.
  assert.equal(isSurfacedRow({ sport: "football", competition: "World Cup", confidence_score: 26 }), true);
  assert.equal(isSurfacedRow({ sport: "football", competition: "World Cup", confidence_score: 25 }), false);
}

// ── #SERIE-B-1: coverage-first precautionary floor 65, no Serie A collision ───
{
  // Lab (scripts/lab_serie_b.py) does not clear ~70% at 56 and is per-season
  // unstable → 65, matching the ALL/VEI cluster.
  assert.equal(surfaceFloorFor("football", "Serie B"), 65);
  assert.equal(surfaceFloorFor("football", "SERIE B"), 65);
  // Serie A must keep the club default — "serie a" never contains "serie b".
  assert.equal(surfaceFloorFor("football", "Serie A"), 56);
  assert.equal(isSurfacedRow({ sport: "football", competition: "Serie B", confidence_score: 64 }), false);
  assert.equal(isSurfacedRow({ sport: "football", competition: "Serie B", confidence_score: 65 }), true);
}

console.log("surfacing gate ok");
