// tests/goalscorer-conservation.test.ts — #GOALSCORER-CALIB-1
// Dimostra il fix di calibrazione: la somma dei λ_giocatore ora = λ_squadra
// (gol conservati). Il modello precedente normalizzava su gol/90 e poi moltiplicava
// per i minuti → Σλ < λ_squadra → sotto-stima sistematica di P(segna).
import assert from "node:assert/strict";
import { computeGoalscorerMarkets } from "../lib/goalscorer-model";

const P = (id: string, goalsPer90: number, minutesShare: number, tier = 1) =>
  ({ playerId: id, name: id, goalsPer90, minutesShare, tier } as any);

const home = [
  P("bomber", 0.8, 1.0),   // titolare prolifico
  P("mid", 0.30, 0.90),    // centrocampista
  P("sub", 1.20, 0.20),    // subentrante: alto rate, pochi minuti
];
const teamLambda = 1.6;
const mk = computeGoalscorerMarkets(teamLambda, 0.1, home, [], [], 99).filter((m) => m.side === "home");

// λ_player ricostruito da pScores = 1 - e^-λ  ⇒  λ = -ln(1-pScores)
const lambdas = mk.map((m) => -Math.log(1 - m.pScores));
const sumL = lambdas.reduce((a, b) => a + b, 0);

// (1) CONSERVAZIONE: Σ λ_player ≈ teamLambda (prima era < )
assert.ok(Math.abs(sumL - teamLambda) < 1e-6, `Σλ=${sumL.toFixed(4)} deve = teamLambda=${teamLambda}`);

// (2) contribuzione attesa = gol/90 × minuti → il bomber (0.8×1.0=0.80) supera
//     mid (0.30×0.90=0.27) e sub (1.20×0.20=0.24)
const byName = Object.fromEntries(mk.map((m) => [m.name, m.pScores]));
assert.ok(byName["bomber"] > byName["mid"] && byName["mid"] > byName["sub"], "ordine per contribuzione attesa");

// (3) tutte le P sono probabilità valide e > 0
assert.ok(mk.every((m) => m.pScores > 0 && m.pScores < 1), "P in (0,1)");

// (4) dimostrazione del bug precedente: la vecchia formula dava
//     share=gol90/Σgol90 poi ×minuti → Σλ_old = teamLambda·Σ(share·minuti) < teamLambda.
const g = home.map((p) => p.goalsPer90), den = g.reduce((a, b) => a + b, 0);
const sumL_old = home.reduce((s, p) => s + teamLambda * (p.goalsPer90 / den) * p.minutesShare, 0);
assert.ok(sumL_old < teamLambda - 0.05, `vecchia formula sotto-allocava: Σλ_old=${sumL_old.toFixed(3)} < ${teamLambda}`);
console.log(`OK — nuovo Σλ=${sumL.toFixed(3)} (=teamLambda) vs vecchio Σλ=${sumL_old.toFixed(3)} (sotto-stima ${((1 - sumL_old / teamLambda) * 100).toFixed(0)}%)`);
console.log("ALL GOALSCORER CHECKS PASSED");
