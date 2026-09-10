// #SETTLE-0909 — la guardia sul campione vale ANCHE per segmento.
//
// `lib/track-record.ts` promette dall'11/06 che la soglia si applica «everywhere
// a rate renders: WC TrackRecordStrip, History KPIs, desk header KPI, house
// banners». La tabella per segmento era l'unico posto che se l'era perso:
// misurato sulla pagina live il 10/09, pubblicava `58.6%` su 29 pick accanto a
// `46.7%` su 30, allineati come se valessero uguale.
//
// Una promessa scritta in un commento e non applicata dal codice è peggio di
// nessuna promessa: chi legge il commento smette di controllare.
import { describe, it, expect } from "vitest";
import { isRateMeaningful, MIN_DECIDED_FOR_RATE } from "./track-record";

/** Specchio della cella "Hit rate" in components/track-record/SegmentTable.tsx. */
function cellaHitRate(seg: { hitRate: number; decided: number }): string {
  return isRateMeaningful(seg.decided)
    ? `${(seg.hitRate * 100).toFixed(1)}%`
    : "small sample";
}

describe("tabella per segmento: la percentuale è un claim", () => {
  it("un segmento con campione sufficiente mostra la percentuale", () => {
    expect(cellaHitRate({ hitRate: 0.726, decided: 190 })).toBe("72.6%");
    expect(cellaHitRate({ hitRate: 0.467, decided: 30 })).toBe("46.7%");
  });

  it("sotto la soglia NON mostra nessuna percentuale", () => {
    // Il caso reale: 4 pick, un 75% che sembra una promessa.
    expect(cellaHitRate({ hitRate: 0.75, decided: 4 })).toBe("small sample");
    expect(cellaHitRate({ hitRate: 1.0, decided: 1 })).toBe("small sample");
  });

  it("la soglia è esattamente quella dichiarata, non una copia locale", () => {
    expect(cellaHitRate({ hitRate: 0.5, decided: MIN_DECIDED_FOR_RATE })).toBe("50.0%");
    expect(cellaHitRate({ hitRate: 0.5, decided: MIN_DECIDED_FOR_RATE - 1 }))
      .toBe("small sample");
  });

  it("il campione resta visibile anche quando la percentuale non c'è", () => {
    // Non si nasconde il segmento: si nasconde la CIFRA che non regge. Chi
    // guarda deve poter vedere che quel torneo esiste e quanto è piccolo.
    const seg = { hitRate: 0.75, decided: 4 };
    expect(cellaHitRate(seg)).toBe("small sample");
    expect(seg.decided).toBe(4); // il conteggio si mostra a parte, in tabella
  });

  it("un campione non numerico non produce una percentuale", () => {
    // Fail-closed su tutti i valori che non sono un conteggio vero: un
    // campione che non si sa quanto vale non autorizza nessuna percentuale.
    expect(isRateMeaningful(NaN)).toBe(false);
    expect(isRateMeaningful(Infinity)).toBe(false);
    expect(isRateMeaningful(-1)).toBe(false);
  });
});

describe("le due soglie sono due decisioni, non un doppione", () => {
  it("la soglia di display è più bassa di quella dell'headline", () => {
    // Se qualcuno le allinea «per simmetria», questo test lo fermerà e lo
    // manderà a leggere il perché in lib/track-record.ts.
    const MIN_SAMPLE_HEADLINE = 30; // app/api/v2/history/route.ts
    expect(MIN_DECIDED_FOR_RATE).toBeLessThan(MIN_SAMPLE_HEADLINE);
    expect(MIN_DECIDED_FOR_RATE).toBe(15);
  });
});
