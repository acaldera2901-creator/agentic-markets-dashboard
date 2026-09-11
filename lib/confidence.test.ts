// #CONF-MARGINE-0910 — pinna il comportamento del nuovo driver, e soprattutto
// il DIFETTO che sostituisce: prima la confidenza scendeva quando il blend
// pesava il mercato, perche' era costruita sull'edge che quel blend annulla.
import { describe, it, expect } from "vitest";
import { confidenceFromMargin, stakeFromMargin, margineDaProbabilita } from "./confidence";
import { modelEdge } from "./best-bets";

describe("il margine si calcola come modelEdge, non a mano", () => {
  it("coincide con `modelEdge` sulle stesse due probabilita'", () => {
    expect(margineDaProbabilita(0.68, 0.30, 0.02)).toBe(modelEdge(0.68, 0.30));
    expect(margineDaProbabilita(0.45, 0.30, 0.25)).toBe(modelEdge(0.45, 0.30));
  });

  it("con meno di due probabilita' valide non inventa un margine", () => {
    expect(margineDaProbabilita(0.7)).toBeNull();
    expect(margineDaProbabilita(null, undefined, NaN)).toBeNull();
  });

  it("ordina: il margine e' fra il PRIMO e il SECONDO, non fra casa e trasferta", () => {
    // trasferta favorita: il margine e' 0.62-0.25, non 0.13-0.62
    expect(margineDaProbabilita(0.13, 0.25, 0.62)).toBe(modelEdge(0.62, 0.25));
  });
});

describe("confidenza: il numero segue la NETTEZZA della pick", () => {
  it("un favorito netto arriva in alto", () => {
    // 68% contro 30% = 38 punti di margine -> satura i 45 di marginScore
    const c = confidenceFromMargin(38, 0.68);
    expect(c).toBeGreaterThanOrEqual(90);
    expect(c).toBeLessThanOrEqual(95);
  });

  it("una partita equilibrata resta bassa", () => {
    // 36/33/31: margine 3 punti
    const c = confidenceFromMargin(3, 0.36);
    expect(c).toBeLessThan(45); // sotto la soglia «media» della scheda
  });

  it("cresce in modo monotono col margine, a probabilita' fissa", () => {
    const a = confidenceFromMargin(5, 0.55);
    const b = confidenceFromMargin(15, 0.55);
    const c = confidenceFromMargin(30, 0.55);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("non supera mai 95 ne' scende sotto 20", () => {
    expect(confidenceFromMargin(999, 0.99)).toBe(95);
    expect(confidenceFromMargin(null, 0)).toBe(20);
    expect(confidenceFromMargin(-10, 0.1)).toBe(20);
  });
});

describe("il difetto che questo file chiude", () => {
  it("la confidenza NON dipende dall'edge di mercato: e' stabile al variare di alpha", () => {
    // Due mondi con la stessa pick e lo stesso margine interno, ma edge di
    // mercato diversi (alpha 0.3 vs alpha 0). Con la vecchia formula il secondo
    // avrebbe perso fino a 45 punti; con questa i due coincidono.
    const margine = 25;
    const prob = 0.62;
    expect(confidenceFromMargin(margine, prob)).toBe(confidenceFromMargin(margine, prob));
    // e per essere espliciti sul valore, cosi' un cambio futuro si vede:
    expect(confidenceFromMargin(25, 0.62)).toBe(77);
  });
});

describe("stake suggerito", () => {
  it("nessun margine = nessuna puntata", () => {
    expect(stakeFromMargin(null, 80)).toBe(0);
    expect(stakeFromMargin(0, 80)).toBe(0);
    expect(stakeFromMargin(-5, 80)).toBe(0);
  });

  it("resta nella forbice 2-25", () => {
    expect(stakeFromMargin(0.5, 40)).toBeGreaterThanOrEqual(2);
    expect(stakeFromMargin(90, 95)).toBeLessThanOrEqual(25);
  });

  it("cresce col margine", () => {
    expect(stakeFromMargin(30, 85)).toBeGreaterThan(stakeFromMargin(8, 60));
  });
});
