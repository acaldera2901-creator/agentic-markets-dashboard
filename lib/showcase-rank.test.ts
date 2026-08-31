// #SHOWCASE-EDGE-0801 — l'ordine della vetrina decide quali righe un abbonato
// vede SBLOCCATE, quindi è una regola di prodotto e va pinnata.
//
// Il difetto che questi test impediscono di reintrodurre: l'ordine era per EDGE
// decrescente. Con il blend (α=0.3) che tira le probabilità verso il mercato per
// costruzione, l'edge sulle righe servite è ≈ 0 e ordinare per edge ordina per
// rumore. Misurato sul board del 2026-08-01 (49 partite football, 4 con pick):
// un abbonato `base` sbloccava 5 righe di cui UNA con un pick, e tre pick su
// quattro finivano ai rank 22, 24 e 42 — incluso quello con la confidenza più
// alta del board (71%), che avendo edge negativo stava quasi ultimo.
import { describe, it, expect } from "vitest";
import {
  compareShowcase,
  showcaseRanking,
  isUnlocked,
  showcaseAllowance,
  type ShowcaseCandidate,
} from "./access-projection";

const row = (
  id: string,
  surfaced: boolean,
  conf: number,
  edge: number | null
): ShowcaseCandidate => ({ id, surfaced, conf, edge });

describe("ordine della vetrina", () => {
  it("un pick batte una riga senza pick, anche con edge molto più basso", () => {
    // È il caso reale che ha motivato il fix: conf 71 con edge NEGATIVO contro
    // conf 48 con edge positivo. Prima vinceva il secondo.
    const pick = row("pick", true, 0.71, -0.0118);
    const noPick = row("no-pick", false, 0.48, 0.0428);
    expect(compareShowcase(pick, noPick)).toBeLessThan(0);
    expect([...showcaseRanking([noPick, pick]).entries()]).toEqual([
      ["pick", 0],
      ["no-pick", 1],
    ]);
  });

  it("fra due pick decide la confidenza, non l'edge", () => {
    const alta = row("alta", true, 0.71, -0.02);
    const bassa = row("bassa", true, 0.62, 0.04);
    expect(compareShowcase(alta, bassa)).toBeLessThan(0);
  });

  it("fra due righe senza pick decide la confidenza, poi l'edge", () => {
    const a = row("a", false, 0.55, 0.001);
    const b = row("b", false, 0.51, 0.030);
    expect(compareShowcase(a, b)).toBeLessThan(0);
    const c = row("c", false, 0.51, 0.010);
    expect(compareShowcase(b, c)).toBeLessThan(0); // stessa conf → edge più alto
  });

  it("edge assente non affonda la riga: conta solo come ultimo spareggio", () => {
    // Una riga senza quote reali (edge null) con confidenza alta deve stare
    // sopra una riga con edge calcolato ma confidenza bassa.
    const senzaQuote = row("senza", true, 0.70, null);
    const conQuote = row("con", true, 0.60, 0.05);
    expect(compareShowcase(senzaQuote, conQuote)).toBeLessThan(0);
    // A parità di tutto il resto, chi ha un edge sta sopra chi non ce l'ha.
    expect(compareShowcase(row("x", true, 0.6, 0.01), row("y", true, 0.6, null))).toBeLessThan(0);
  });

  it("NaN e Infinity nell'edge non rompono l'ordine", () => {
    const nan = row("nan", true, 0.6, Number.NaN);
    const ok = row("ok", true, 0.6, 0.01);
    expect(compareShowcase(ok, nan)).toBeLessThan(0);
    expect(() => showcaseRanking([nan, ok, row("inf", true, 0.6, Infinity)])).not.toThrow();
  });

  it("l'ordine è deterministico: stesso input, stesso rank a ogni ciclo", () => {
    // Senza il tiebreak su id due righe identiche si scambierebbero a ogni
    // ciclo, e con loro cambierebbe cosa l'utente trova sbloccato.
    const rows = [row("b", true, 0.6, 0.01), row("a", true, 0.6, 0.01)];
    expect([...showcaseRanking(rows).keys()]).toEqual(["a", "b"]);
    expect([...showcaseRanking([...rows].reverse()).keys()]).toEqual(["a", "b"]);
  });

  it("non muta l'array in ingresso", () => {
    const rows = [row("z", false, 0.4, null), row("a", true, 0.9, 0.1)];
    const before = rows.map((r) => r.id);
    showcaseRanking(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it("il board reale del 2026-08-01: i 4 pick finiscono nei primi 4 posti", () => {
    // Ricostruzione dal board servito quel giorno. Con l'ordine per edge i pick
    // stavano ai rank 0, 22, 24 e 42; con questo ordine stanno davanti, quindi
    // un abbonato base (7 slot) li vede tutti e quattro.
    const board: ShowcaseCandidate[] = [
      row("ELI-vaalerenga", true, 0.62, 0.0437),
      row("ALL-goteborg", false, 0.48, 0.0428),
      row("BEL-standard", false, 0.37, 0.0317),
      row("ALL-orgryte", false, 0.51, 0.0269),
      row("POL-legia", false, 0.56, 0.0260),
      row("LOI-bohemians", false, 0.55, 0.0258),
      row("DNK-brondby", false, 0.47, 0.0243),
      row("ALL-halmstads", true, 0.69, 0.0069),
      row("ALL-aik", true, 0.65, 0.0061),
      row("ELI-viking", true, 0.71, -0.0118),
    ];
    const rank = showcaseRanking(board);
    const picks = board.filter((r) => r.surfaced).map((r) => rank.get(r.id)!);
    expect(picks.sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    // e il pick con la confidenza più alta è il primo: è il "pick of the day".
    expect(rank.get("ELI-viking")).toBe(0);
    // un abbonato base (7 slot) vede tutti e quattro i pick
    const unlockedPicks = board.filter(
      (r) => r.surfaced && isUnlocked("base", rank.get(r.id)!)
    );
    expect(unlockedPicks).toHaveLength(4);
    // e le 3 righe che il free sblocca sono tutte pick, non righe senza favorito
    const freeRows = board.filter((r) => isUnlocked("free", rank.get(r.id)!));
    expect(freeRows).toHaveLength(3);
    expect(freeRows.every((r) => r.surfaced)).toBe(true);
  });

  it("quote della vetrina, per sport e per giorno (#FREE-BASE-DAILY-QUOTA-0831)", () => {
    expect(showcaseAllowance("free")).toBe(3);
    expect(showcaseAllowance("base")).toBe(7);
    expect(showcaseAllowance("premium")).toBe(Infinity);
    expect(showcaseAllowance("anonymous")).toBe(0);
  });

  it("board di soli non-pick: nessuno viene promosso a forza", () => {
    // Il fix non inventa pick dove non ce ne sono: se nessuna riga supera il
    // floor, l'ordine è per confidenza e chi si sblocca resta senza direzione.
    const board = [row("a", false, 0.40, 0.05), row("b", false, 0.52, null)];
    const rank = showcaseRanking(board);
    expect(rank.get("b")).toBe(0);
    expect(board.find((r) => rank.get(r.id) === 0)!.surfaced).toBe(false);
  });
});
