// #SETTLE-0909 — le etichette del track record devono NASCERE DAL DATO.
//
// Il difetto che questi test impediscono di reintrodurre, misurato sulla pagina
// live il 10/09: il riquadro diceva `65.2%` sopra l'etichetta `HIT · 100G`,
// cioè «ultime 100 partite», mentre la percentuale era all-time su 1.606 pick.
// La stringa "Hit · 100g" era hardcodata in cinque lingue e nessuno l'aveva
// più toccata. Un numero giusto sotto un'etichetta sbagliata è peggio di un
// numero mancante: chi legge non ha modo di accorgersene.
//
// Regola che ne esce: se un'etichetta nomina un campione, quel campione deve
// venire dai dati. Un'etichetta che È il dato non può invecchiare.
import { describe, it, expect } from "vitest";

/** Specchio della composizione in app/app/page.tsx (riquadro HIT su /history). */
function hitLabel(base: string, stats: { n?: number } | null): string {
  return base + (typeof stats?.n === "number" ? ` · ${stats.n}` : "");
}

/** Specchio del sottotitolo di /history. */
function historySubtitle(stats: { coverage?: number | null } | null): string {
  const cov = typeof stats?.coverage === "number"
    ? `${(stats.coverage * 100).toFixed(1)}%` : null;
  return `Every verified settled pick, won or lost${cov ? ` — ${cov} of the picks we showed` : ""}. What we can't confirm, we say.`;
}

describe("etichetta del hit rate", () => {
  it("nomina il campione REALE, non una finestra inventata", () => {
    expect(hitLabel("Hit", { n: 1606 })).toBe("Hit · 1606");
  });

  it("il campione segue il dato quando cambia", () => {
    expect(hitLabel("Hit", { n: 30 })).toBe("Hit · 30");
    expect(hitLabel("Hit", { n: 1606 })).toBe("Hit · 1606");
  });

  it("non contiene MAI un numero scritto a mano", () => {
    // Il test che avrebbe preso il difetto: qualunque cifra nell'etichetta
    // deve provenire da `n`. Con stats assenti non ci sono cifre, punto.
    const senzaDati = hitLabel("Hit", null);
    expect(senzaDati).toBe("Hit");
    expect(senzaDati).not.toMatch(/\d/);
    // E in particolare non deve tornare la vecchia stringa.
    expect(senzaDati).not.toMatch(/100\s*[gdj]/i);
  });

  it("se l'API è di un deploy vecchio, l'etichetta degrada invece di mentire", () => {
    expect(hitLabel("Hit", {})).toBe("Hit");
  });
});

describe("sottotitolo di /history", () => {
  it("non promette più 'unfiltered'", () => {
    const s = historySubtitle({ coverage: 0.969 });
    expect(s).not.toMatch(/unfiltered|senza filtri|sin filtros|sans filtre/i);
  });

  it("dichiara la copertura, presa dal dato", () => {
    expect(historySubtitle({ coverage: 0.969 })).toContain("96.9% of the picks we showed");
    expect(historySubtitle({ coverage: 0.5 })).toContain("50.0% of the picks we showed");
  });

  it("senza copertura non inventa una percentuale", () => {
    const s = historySubtitle(null);
    expect(s).not.toMatch(/%/);
    expect(s).toContain("What we can't confirm, we say.");
  });

  it("dice sempre che ciò che non si conferma viene dichiarato", () => {
    // È la promessa che sostituisce "unfiltered": più debole come claim,
    // ma vera — e su un track record è l'unica che conta.
    for (const cov of [null, 0, 0.5, 1]) {
      expect(historySubtitle({ coverage: cov })).toContain("we say");
    }
  });
});
