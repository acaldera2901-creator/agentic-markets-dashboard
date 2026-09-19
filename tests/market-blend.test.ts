import assert from "node:assert/strict";
import {
  blendWithMarket,
  devig1x2,
  MARKET_BLEND_ALPHA,
} from "../lib/poisson-model";

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

// ── MARKET_BLEND_ALPHA ─────────────────────────────────────────────────────
// Il pin resta: serve a impedire che il valore derivi in silenzio. Cambia solo
// il numero, e la ragione e' MISURATA.
//
// Era 0.3, «backtest-justified default»
// (docs/internal/reliability-upgrade-2026-06-06.md): α≈0.3 tiene quasi tutto il
// guadagno di calibrazione preservando l'identita' del modello.
//
// #ALPHA-02-0910 — walk-forward su `prediction_log` (1.067 partite reali, non
// snapshot: mediana 61 snapshot per partita), expanding, passo 7g, burn-in 28g.
// α=0.2 e' significativo (t=-2,66), segni 569/429 con p<0,0001 e dose-risposta
// monotona. Effetto di prodotto: pick pubblicate 71 -> 79 (+11%), hit
// 84,5% -> 86,1%. NON si scende a 0 (che e' l'ottimo statistico): azzera l'edge
// servito per costruzione, e l'asserzione poche righe sotto — «b.pHome >
// line.home» — pretende α>0. Quel test, scritto mesi prima, e' esso stesso la
// prova che α=0 rompe un invariante dichiarato.
assert.equal(MARKET_BLEND_ALPHA, 0.2);

// ── devig1x2 ───────────────────────────────────────────────────────────────
// Fair (no-vig) book: 1/2/4 → inverse 0.5/0.25/0.25, sum = 1 → unchanged.
{
  const p = devig1x2(2, 4, 4);
  assert.ok(p !== null);
  approx(p!.home, 0.5);
  approx(p!.draw, 0.25);
  approx(p!.away, 0.25);
  approx(p!.home + p!.draw + p!.away, 1);
}

// Real book with overround normalizes to sum = 1.
{
  const p = devig1x2(1.9, 3.5, 4.2);
  assert.ok(p !== null);
  approx(p!.home + p!.draw + p!.away, 1);
  // home is the shortest price → highest probability.
  assert.ok(p!.home > p!.draw && p!.home > p!.away);
}

// Missing / non-positive odds → null (no fabricated market, P0 #2).
assert.equal(devig1x2(null, 3.5, 4.2), null);
assert.equal(devig1x2(1.9, null, 4.2), null);
assert.equal(devig1x2(1.9, 3.5, null), null);
assert.equal(devig1x2(0, 3.5, 4.2), null);
assert.equal(devig1x2(-1, 3.5, 4.2), null);

// ── blendWithMarket ────────────────────────────────────────────────────────
const model = { pHome: 0.6, pDraw: 0.25, pAway: 0.15 };
const market = { home: 0.4, draw: 0.3, away: 0.3 };

// α = 1 → identity (pure model), exact.
{
  const b = blendWithMarket(model, market, 1);
  approx(b.pHome, model.pHome);
  approx(b.pDraw, model.pDraw);
  approx(b.pAway, model.pAway);
}

// α = 0 → pure market.
{
  const b = blendWithMarket(model, market, 0);
  approx(b.pHome, market.home);
  approx(b.pDraw, market.draw);
  approx(b.pAway, market.away);
}

// Normal blend α = 0.3: p = 0.3·model + 0.7·market, sum stays 1.
{
  const b = blendWithMarket(model, market, 0.3);
  approx(b.pHome, 0.3 * 0.6 + 0.7 * 0.4);
  approx(b.pDraw, 0.3 * 0.25 + 0.7 * 0.3);
  approx(b.pAway, 0.3 * 0.15 + 0.7 * 0.3);
  approx(b.pHome + b.pDraw + b.pAway, 1);
}

// Market absent (null) → identity, fail-safe (= current behaviour).
{
  const b = blendWithMarket(model, null, 0.3);
  approx(b.pHome, model.pHome);
  approx(b.pDraw, model.pDraw);
  approx(b.pAway, model.pAway);
}

// Blend pulls a divergent model pick toward the market (the whole point:
// underdog/longshot segment where the model over-confidently diverged).
{
  const overconfident = { pHome: 0.8, pDraw: 0.12, pAway: 0.08 };
  const line = { home: 0.45, draw: 0.28, away: 0.27 };
  const b = blendWithMarket(overconfident, line, MARKET_BLEND_ALPHA);
  assert.ok(b.pHome < overconfident.pHome, "blend must shrink the divergent pick");
  assert.ok(b.pHome > line.home, "but stay above the pure-market value");
}

console.log("market blend ok");
