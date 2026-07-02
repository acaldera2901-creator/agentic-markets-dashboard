// tests/goalscorer-conservation.test.ts — #GOALSCORER-CALIB-1
// Dimostra il fix di calibrazione: la somma dei λ_giocatore ora = λ_squadra
// (gol conservati). Il modello precedente normalizzava su gol/90 e poi moltiplicava
// per i minuti → Σλ < λ_squadra → sotto-stima sistematica di P(segna).
import assert from "node:assert/strict";
import { computeGoalscorerMarkets, calibrateScorerProb } from "../lib/goalscorer-model";

const P = (id: string, goalsPer90: number, minutesShare: number, tier = 1) =>
  ({ playerId: id, name: id, goalsPer90, minutesShare, tier } as any);

const home = [
  P("bomber", 0.8, 1.0),   // titolare prolifico
  P("mid", 0.30, 0.90),    // centrocampista
  P("sub", 1.20, 0.20),    // subentrante: alto rate, pochi minuti
];
const teamLambda = 1.6;
// calibrate=false → testa l'allocazione GREZZA (conservazione). La calibrazione
// isotonica è testata a parte sotto (rompe di proposito Σλ per allinearsi ai tassi reali).
const mk = computeGoalscorerMarkets(teamLambda, 0.1, home, [], [], 99, false).filter((m) => m.side === "home");

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

// ── (5) CALIBRAZIONE ISOTONICA ──
// monotòna e limitata
let prev = -1;
for (let x = 0; x <= 1.0001; x += 0.05) {
  const c = calibrateScorerProb(x);
  assert.ok(c >= 0 && c <= 1, `calibrato in [0,1] (x=${x.toFixed(2)}→${c})`);
  assert.ok(c >= prev - 1e-9, `monotòna non decrescente (x=${x.toFixed(2)})`);
  prev = c;
}
// pull-down dei bomber (corregge l'over-prediction): 0.5 grezzo → ~0.39
assert.ok(calibrateScorerProb(0.5) < 0.45 && calibrateScorerProb(0.5) > 0.30, `top pull-down: ${calibrateScorerProb(0.5).toFixed(3)}`);
// floor sui bassi (i "quasi 0" segnano comunque ~4%)
assert.ok(calibrateScorerProb(0.005) > 0.02, `floor bassi: ${calibrateScorerProb(0.005).toFixed(3)}`);
// applicata di default: il bomber calibrato < grezzo quando il grezzo è alto
const rawTop = mk.find((m) => m.name === "bomber")!.pScores; // mk è calibrate=false (grezzo)
const calTop = computeGoalscorerMarkets(teamLambda, 0.1, home, [], [], 99).find((m) => m.name === "bomber")!.pScores;
if (rawTop > 0.35) assert.ok(calTop < rawTop, `calibrazione applicata di default (raw ${rawTop.toFixed(3)} → cal ${calTop.toFixed(3)})`);
console.log(`OK calibrazione — 0.5→${calibrateScorerProb(0.5).toFixed(3)}, 0.005→${calibrateScorerProb(0.005).toFixed(3)}, bomber raw ${rawTop.toFixed(3)}→cal ${calTop.toFixed(3)}`);
console.log("ALL GOALSCORER CHECKS PASSED");
