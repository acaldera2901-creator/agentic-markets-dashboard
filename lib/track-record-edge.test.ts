// lib/track-record-edge.test.ts — #EDGE-SELETTIVITA-0917
//
// Quello che va provato rompendolo non e' la divisione: e' che una riga SENZA
// confidenza non finisca fra le pick su cui dichiariamo un vantaggio. Il dato
// assente e' il modo classico in cui una soglia si apre da sola.
import { describe, it, expect } from "vitest";
import {
  EDGE_MIN_CONFIDENCE,
  isEdgePick,
  edgeTally,
  MIN_DECIDED_FOR_RATE,
} from "./track-record";

const riga = (confidence_score: number | null, result: string) => ({
  confidence_score,
  result,
});
const n = (quante: number, conf: number | null, esito: string) =>
  Array.from({ length: quante }, () => riga(conf, esito));

describe("isEdgePick", () => {
  it("la soglia e' inclusiva: 62 e' Edge, 61,9 no", () => {
    expect(isEdgePick(EDGE_MIN_CONFIDENCE)).toBe(true);
    expect(isEdgePick(EDGE_MIN_CONFIDENCE - 0.1)).toBe(false);
  });

  it("confidenza assente NON e' Edge (fail-closed)", () => {
    expect(isEdgePick(null)).toBe(false);
    expect(isEdgePick(undefined)).toBe(false);
  });

  it("un valore non finito non passa per la porta di servizio", () => {
    expect(isEdgePick(NaN)).toBe(false);
    // Infinity >= 62 e' vero, ma una confidenza infinita non e' una confidenza:
    // il guard e' Number.isFinite, non il solo confronto. (Avevo scritto il
    // contrario in questo test: il codice aveva ragione, l'asserzione no.)
    expect(isEdgePick(Infinity as unknown as number)).toBe(false);
    expect(isEdgePick("80" as unknown as number)).toBe(false);    // stringa no
  });
});

describe("edgeTally", () => {
  it("conta solo le righe DECISE: void e pending non entrano da nessuna parte", () => {
    const t = edgeTally([
      riga(70, "won"), riga(70, "lost"),
      riga(70, "void"), riga(70, "pending"), riga(70, null as unknown as string),
    ]);
    expect(t.n).toBe(2);
    expect(t.won).toBe(1);
    expect(t.lost).toBe(1);
    expect(t.share).toBe(1); // 2 Edge su 2 decise
  });

  it("la quota di volume e' calcolata sulle decise, non sul totale righe", () => {
    const t = edgeTally([
      ...n(3, 70, "won"),      // Edge decise
      ...n(7, 50, "lost"),     // sotto soglia, decise
      ...n(5, 90, "void"),     // Edge ma non decise: fuori da tutto
    ]);
    expect(t.n).toBe(3);
    expect(t.share).toBe(0.3);
  });

  it("sotto la soglia di display la percentuale NON si restituisce", () => {
    const t = edgeTally(n(MIN_DECIDED_FOR_RATE - 1, 80, "won"));
    expect(t.n).toBe(MIN_DECIDED_FOR_RATE - 1);
    expect(t.win_rate).toBeNull();     // 14 vittorie su 14 non fanno un 100%
    expect(t.won).toBe(MIN_DECIDED_FOR_RATE - 1); // il record grezzo resta
  });

  it("raggiunta la soglia, la percentuale compare", () => {
    const t = edgeTally([...n(MIN_DECIDED_FOR_RATE, 80, "won")]);
    expect(t.win_rate).toBe(100);
  });

  it("le righe senza confidenza restano nel resto, non nell'Edge", () => {
    const t = edgeTally([...n(20, null, "won"), ...n(20, 70, "lost")]);
    expect(t.n).toBe(20);
    expect(t.won).toBe(0);
    expect(t.lost).toBe(20);
    expect(t.share).toBe(0.5);
  });

  it("lista vuota: niente percentuale, niente quota, nessuna eccezione", () => {
    const t = edgeTally([]);
    expect(t).toEqual({ n: 0, won: 0, lost: 0, share: null, win_rate: null });
  });

  it("riproduce la separazione misurata in produzione il 17/09", () => {
    // 1.155 Edge su 2.880 righe decise, 815 vinte = 70,6%; resto 867/1.725.
    const righe = [
      ...n(815, 70, "won"), ...n(340, 70, "lost"),
      ...n(867, 50, "won"), ...n(858, 50, "lost"),
    ];
    const t = edgeTally(righe);
    expect(t.n).toBe(1155);
    expect(t.win_rate).toBe(70.6);
    expect(t.share).toBe(0.401);
  });
});
