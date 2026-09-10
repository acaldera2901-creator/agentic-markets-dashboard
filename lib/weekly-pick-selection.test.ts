// #WEEKLY-PICK-FOOTBALL-0910 — la Weekly Pick torna un prodotto difendibile.
//
// Tre difetti misurati il 10/09 sulle 10 settimane da luglio:
//
// 1. IL CALCIO NON ENTRAVA IN GARA. La probabilità del calcio si leggeva dal
//    JSON `notes` (p_home/p_draw/p_away), che su unified_predictions è VUOTO su
//    ogni riga: 245 righe di calcio pubblicate nella settimana del 07/09, 18 con
//    una pick, `p_home` presente in ZERO. Quindi 8 weekly pick su 10 erano al
//    100% tennis — non per scelta del modello, ma perché il calcio non arrivava
//    al confronto.
// 2. CINQUE GAMBE. Probabilità combinata media dichiarata 28,1%: un prodotto
//    venduto come «la più probabile della settimana» che per costruzione perde
//    7 volte su 10 (e 6 su 10 le ha perse). Il modello era calibrato — la
//    premessa del prodotto era falsa.
// 3. UNA GAMBA ANNULLATA CONTAVA COME VINTA. La settimana del 27/07 risulta
//    «Passata» con TRE gambe su cinque annullate: una vittoria per abbandono,
//    finita nel track record che regge l'upsell.
import { describe, it, expect } from "vitest";
import {
  buildHouseMultipla,
  appendWeeklyLegs,
  resolveWeeklyPickOutcomes,
  WEEKLY_PICK_MAX_LEGS,
  WEEKLY_PICK_MIN_LEG_PROB,
  type WeeklyPickLeg,
} from "./weekly-pick";

const gamba = (
  id: string, prob: number, giorno: string, sport = "tennis"
): WeeklyPickLeg => ({
  id, label: `partita ${id}`, market: "X", sport, prob,
  startsAt: `${giorno}T12:00:00+00`,
});

describe("quante gambe", () => {
  it("sono TRE, non cinque", () => {
    // Non è un dettaglio di configurazione: è la differenza fra 28% e 50%.
    expect(WEEKLY_PICK_MAX_LEGS).toBe(3);
  });

  it("con tre gambe al 75-88% la combinata sta sopra il 50%", () => {
    const m = buildHouseMultipla([
      gamba("a", 0.88, "2026-09-08"),
      gamba("b", 0.84, "2026-09-09"),
      gamba("c", 0.77, "2026-09-10"),
      gamba("d", 0.71, "2026-09-11"),
      gamba("e", 0.69, "2026-09-12"),
    ])!;
    expect(m.selections).toHaveLength(3);
    expect(m.combinedProb).toBeGreaterThan(0.5);
    // Le stesse cinque gambe, tutte insieme, davano 0.279: è il difetto misurato.
    const cinque = buildHouseMultipla([
      gamba("a", 0.88, "2026-09-08"), gamba("b", 0.84, "2026-09-09"),
      gamba("c", 0.77, "2026-09-10"), gamba("d", 0.71, "2026-09-11"),
      gamba("e", 0.69, "2026-09-12"),
    ], 5)!;
    expect(cinque.combinedProb).toBeLessThan(0.3);
  });

  it("prende le tre PIU' probabili, non le prime tre", () => {
    const m = buildHouseMultipla([
      gamba("bassa", 0.60, "2026-09-08"),
      gamba("alta", 0.90, "2026-09-09"),
      gamba("media", 0.75, "2026-09-10"),
      gamba("altissima", 0.95, "2026-09-11"),
    ])!;
    const ids = m.selections.map((s) => s.id).sort();
    expect(ids).toEqual(["alta", "altissima", "media"]);
  });
});

describe("il pavimento per gamba", () => {
  it("esiste e non è zero", () => {
    // Prima bastava `prob > 0`: una gamba al 5% poteva entrare nella «più
    // probabile della settimana».
    expect(WEEKLY_PICK_MIN_LEG_PROB).toBeGreaterThanOrEqual(0.5);
  });

  it("meglio due gambe solide che tre con una debole", () => {
    // Il pavimento si applica a monte (nella route), quindi qui si verifica il
    // principio: la multipla regge con 2 gambe.
    const m = buildHouseMultipla([
      gamba("a", 0.88, "2026-09-08"),
      gamba("b", 0.84, "2026-09-09"),
    ])!;
    expect(m.selections).toHaveLength(2);
    expect(m.combinedProb).toBeCloseTo(0.7392, 4);
  });
});

describe("la schedina non cambia dopo che è completa", () => {
  it("a tre gambe non si appende piu' niente", () => {
    // È ciò che rende innocuo il generatore che gira ogni 2 ore: da completa in
    // poi, chi ha comprato vede per sempre quello che ha comprato.
    const complete = [
      gamba("a", 0.88, "2026-09-08"),
      gamba("b", 0.84, "2026-09-09"),
      gamba("c", 0.77, "2026-09-10"),
    ];
    const nuovo = appendWeeklyLegs(complete, [gamba("d", 0.99, "2026-09-11")]);
    expect(nuovo).toBeNull();
  });

  it("finche' e' incompleta cresce (ed e' per questo che non si vende)", () => {
    const due = [gamba("a", 0.88, "2026-09-08"), gamba("b", 0.84, "2026-09-09")];
    const nuovo = appendWeeklyLegs(due, [gamba("c", 0.77, "2026-09-10")]);
    expect(nuovo).not.toBeNull();
    expect(nuovo!.selections).toHaveLength(3);
    // E la combinata SCENDE: e' esattamente il danno che il gate d'acquisto
    // impedisce di infliggere a chi ha già pagato.
    expect(nuovo!.combinedProb).toBeLessThan(0.88 * 0.84);
  });
});

describe("una gamba annullata esce, non vince", () => {
  const legs = [
    gamba("wp_p1", 0.9, "2026-09-08"),
    gamba("wp_p2", 0.9, "2026-09-09"),
    gamba("wp_p3", 0.9, "2026-09-10"),
  ];
  const riga = (id: string, result: string) => ({
    id, status: "settled", result, starts_at: "2026-09-08T12:00:00+00",
  });

  it("due vinte e una annullata: PASSATA (una gamba c'e')", () => {
    const r = resolveWeeklyPickOutcomes(legs, [
      riga("p1", "won"), riga("p2", "won"), riga("p3", "void"),
    ]);
    expect(r.outcome).toBe("won");
    expect(r.vinte).toBe(2);
    expect(r.annullate).toBe(1);
  });

  it("TUTTE annullate: non e' una vittoria", () => {
    // Il difetto vecchio: nessuna persa + nessuna pendente = «won». Cioe' una
    // multipla in cui non si e' giocato niente risultava vinta.
    const r = resolveWeeklyPickOutcomes(legs, [
      riga("p1", "void"), riga("p2", "void"), riga("p3", "void"),
    ]);
    expect(r.outcome).not.toBe("won");
    expect(r.vinte).toBe(0);
  });

  it("una persa fa perdere tutto, annullate o no", () => {
    const r = resolveWeeklyPickOutcomes(legs, [
      riga("p1", "won"), riga("p2", "void"), riga("p3", "lost"),
    ]);
    expect(r.outcome).toBe("lost");
  });

  it("una gamba ancora da giocare tiene la multipla in corso", () => {
    const r = resolveWeeklyPickOutcomes(legs, [riga("p1", "won"), riga("p2", "won")]);
    expect(r.outcome).toBe("live");
    expect(r.remaining).toBe(1);
  });
});
