import assert from "node:assert/strict";
import {
  SURFACE_FLOOR_FOOTBALL,
  surfaceDecision,
} from "../lib/surfacing-gate";

// ── Single source of truth ──────────────────────────────────────────────────
// Must mirror config/settings.py SURFACE_FLOOR_FOOTBALL (56). If the Python
// floor moves, this constant and this assertion move with it.
assert.equal(SURFACE_FLOOR_FOOTBALL, 56);

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

console.log("surfacing gate ok");
