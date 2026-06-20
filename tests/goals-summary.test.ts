import assert from "node:assert/strict";
import { computeGoalsSummary } from "../lib/poisson-model";

const approx = (a: number, b: number, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

// Caso non intero: λH=1.5, λA=1.1 → gol attesi 2.6, fascia [2,3].
// Somma di due Poisson indip. = Poisson(2.6). P(T=2)+P(T=3) ≈ 0.4686.
{
  const g = computeGoalsSummary(1.5, 1.1);
  assert.equal(g.expected_goals, 2.6);
  assert.equal(g.band_low, 2);
  assert.equal(g.band_high, 3);
  approx(g.band_p, 0.4686);
}

// Caso intero: λH=1.0, λA=1.0 → gol attesi 2.0, fascia [2,2] = P(T=2) ≈ 0.2707.
{
  const g = computeGoalsSummary(1.0, 1.0);
  assert.equal(g.expected_goals, 2);
  assert.equal(g.band_low, 2);
  assert.equal(g.band_high, 2);
  approx(g.band_p, 0.2707);
}

// Guard: λ molto piccoli non devono lanciare e restano coerenti.
{
  const g = computeGoalsSummary(0.2, 0.1);
  assert.equal(g.expected_goals, 0.3);
  assert.equal(g.band_low, 0);
  assert.equal(g.band_high, 1);
  assert.ok(g.band_p > 0 && g.band_p <= 1);
}

console.log("goals-summary: all assertions passed");
