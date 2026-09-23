// lib/locked-card-gate.test.ts — #RESTYLING-0921 round 15
//
// Il bug che questo guard rende impossibile da rifare (misurato da qa-andrea
// sul round 14: 29 card su 29 viste da anonimo, 29 click morti).
//
// Una card chiusa ha come CTA «Unlock full analysis». Se il click chiama
// `onOpenMatch(key)` senza guardare `locked`, il flusso arriva a
// `MatchDetailHost` → `PredictionCard autoOpen`, dove
// `modalEnabled = !p.locked && !isPreview` è FALSO: `openModal()` non parte,
// non c'è navigazione, non c'è modal, non c'è paywall. Nessun errore in
// console, nessun test rosso — solo un bottone che non fa niente, che è il
// modo più costoso di rompere una conversione.
//
// La guardia giusta esiste da sempre nel ramo board (`PredictionCard` /
// `TennisMatchCard`): `if (!modalEnabled) { onGate?.(); return; }`. Questo
// test pretende che OGNI punto che apre una partita dalla lobby abbia la
// stessa cosa a monte.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESK = join(REPO_ROOT, "app/app/page.tsx");

/** Le righe che CHIAMANO `onOpenMatch(...)` — non le prop né i tipi. */
function righeCheAprono(src: string): number[] {
  return src
    .split("\n")
    .map((riga, i) => ({ riga: riga.trim(), n: i }))
    .filter(({ riga }) =>
      /(^|[^.\w])onOpenMatch\(/.test(riga)
      && !riga.startsWith("//")
      && !riga.startsWith("*")
      && !/onOpenMatch[?:=]/.test(riga))
    .map(({ n }) => n);
}

describe("una card chiusa porta al gate, non a un click morto", () => {
  const src = readFileSync(DESK, "utf8");
  const righe = src.split("\n");
  const aperture = righeCheAprono(src);

  it("esiste almeno un punto che apre una partita (il guard non è vuoto)", () => {
    expect(aperture.length).toBeGreaterThan(0);
  });

  it("ogni apertura ha la guardia sul locked nelle righe subito sopra", () => {
    const senzaGuardia = aperture.filter((n) => {
      const sopra = righe.slice(Math.max(0, n - 12), n).join("\n");
      return !(/locked/.test(sopra) && /onGate\?\.\(\)/.test(sopra));
    });
    expect(senzaGuardia.map((n) => `${n + 1}: ${righe[n].trim()}`)).toEqual([]);
  });

  it("il ramo board conserva la sua guardia originale", () => {
    const guardie = src.match(/if \(!modalEnabled\) \{ onGate\?\.\(\); return; \}/g) ?? [];
    expect(guardie.length).toBe(2); // football + tennis
  });
});
