import { describe, it, expect } from "vitest";
import { tennisPredictionToUnifiedInsert } from "@/lib/tennis-adapter";

// #TENNIS-MARKET-ANCHOR-0821 — after the Python full-market anchor, tennis_predictions
// carries p1/p2 = de-vigged market and edge = null (no edge claim, like MLB/UFC). This
// pins the TS contract the anchor relies on: the SERVED confidence is exactly
// round(market prob x 100), and a null edge downgrades the row to an honest
// market-anchored (paper, no edge) row — never a fabricated value bet.
//
// NB co-located under lib/ on purpose: vitest.config.ts `include` is
// {app,lib,components,features}/**/*.test.ts, so a file in tests/ would never run.

function devig2way(o1: number, o2: number) {
  const inv1 = 1 / o1;
  const inv2 = 1 / o2;
  const s = inv1 + inv2;
  return { p1: inv1 / s, p2: inv2 / s };
}

function baseRow() {
  return {
    match_id: "anchor-1",
    tournament: "Wimbledon", // hi tier -> floor 62
    surface: "grass",
    player1: "Player A",
    player2: "Player B",
    scheduled_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    p1: null as number | null,
    p2: null as number | null,
    odds_p1: null as number | null,
    odds_p2: null as number | null,
    edge: null as number | null,
    best_selection: null as string | null,
    model_version: "tennis-elo-v1",
    serve_form_p1: 0.66,
    serve_form_p2: 0.62,
    return_form_p1: 0.4,
    return_form_p2: 0.38,
    feature_quality: 0.9,
  };
}

describe("tennis market-anchor served row", () => {
  it("served confidence == round(market prob x 100)", () => {
    const oddsP1 = 1.3;
    const oddsP2 = 3.9;
    const mkt = devig2way(oddsP1, oddsP2); // p1 ~0.75, clears the 62 floor

    const row = baseRow();
    // Python full anchor: served p1/p2 ARE the de-vigged market, pick = favourite,
    // edge = null (no edge claim against the copied line).
    row.p1 = Math.round(mkt.p1 * 10000) / 10000;
    row.p2 = Math.round(mkt.p2 * 10000) / 10000;
    row.odds_p1 = oddsP1;
    row.odds_p2 = oddsP2;
    row.best_selection = mkt.p1 >= mkt.p2 ? "P1" : "P2";
    row.edge = null;

    const d = tennisPredictionToUnifiedInsert(row);

    const pickedProb = row.best_selection === "P1" ? row.p1 : row.p2;

    // #CURSE-ANCHORED-0911 — QUESTO CONTRATTO E' CAMBIATO DI PROPOSITO.
    // Fino all'11/09 la confidence servita era esattamente round(mercato x 100),
    // e questo test lo pinnava. Poi e' stato misurato che le righe ancorate
    // dichiaravano 68,1% e ne realizzavano 62,2% (n=911, z=-3,94): non un
    // difetto del de-vig — l'errore si INVERTE sopra l'85% — ma un bias di
    // selezione del floor (winner's curse). Ora la probabilita' mostrata passa
    // da una temperatura 1.68, stimata su holdout temporale, che risana la
    // calibrazione (-5,9pt z=-2,94 -> +1,5pt z=+0,70).
    // La riga NON e' piu' il mercato copiato: e' il mercato corretto per come
    // noi lo selezioniamo.
    const grezza = Math.round((pickedProb as number) * 100);
    expect(grezza).toBe(75);
    expect(d.confidence_score).toBeLessThan(grezza);
    expect(d.confidence_score).toBe(66);

    // ...ma il floor continua a decidere sulla scala GREZZA, quindi seleziona
    // esattamente come prima: 75 >= 62 -> il favorito del mercato resta il pick.
    // Se un giorno il gate ricevesse il numero corretto, 66 sarebbe comunque
    // sopra 62 e questo test non se ne accorgerebbe — per questo il caso
    // decisivo e' quello sotto il floor, nel test successivo.
    expect(d.pick).toBe("Player A");

    // Market-anchored honesty: null edge => paper, no fabricated edge/value.
    expect(d.edge_percent).toBeNull();
    expect(d.signal_type).toBe("paper");
    expect(d.is_paper).toBe(true);

    // #TENNIS-MARKET-ANCHOR-0821 display fix: the odds are REAL (we anchored the
    // probability to them), so they MUST be shown and the bookmaker must NOT read
    // "no market" even though edge is null. Before the fix, odds/bookmaker were
    // gated on `edge != null` and this row wrongly showed "no market"/null odds.
    expect(d.odds).toBe(1.3);
    expect(d.bookmaker).toBe("market composite");
  });

  it("below the floor the anchored row surfaces no directional pick", () => {
    const oddsP1 = 1.95;
    const oddsP2 = 2.1;
    const mkt = devig2way(oddsP1, oddsP2); // p1 ~0.52 -> below the 62 floor

    const row = baseRow();
    row.p1 = Math.round(mkt.p1 * 10000) / 10000;
    row.p2 = Math.round(mkt.p2 * 10000) / 10000;
    row.odds_p1 = oddsP1;
    row.odds_p2 = oddsP2;
    row.best_selection = "P1";
    row.edge = null;

    const d = tennisPredictionToUnifiedInsert(row);

    // #CURSE-ANCHORED-0911 — il test decisivo sulla SEPARAZIONE fra il numero
    // mostrato e il numero che seleziona.
    //
    // La confidence mostrata e' corretta (52 grezzo -> piu' vicino al 50%)...
    const grezza = Math.round((row.p1 as number) * 100);
    expect(grezza).toBe(52);
    expect(d.confidence_score).toBeLessThan(grezza);
    // ...e il pick resta nullo perche' il FLOOR guarda il grezzo: 52 < 62.
    // Qui sta il valore del caso: correggendo verso il 50% la riga si allontana
    // ancora di piu' dal floor, quindi il `null` non prova nulla da solo — ma
    // insieme al test sopra (75 grezzo -> 66 mostrato, pick PRESENTE) dimostra
    // che la selezione non e' cambiata mentre il numero si'.
    expect(d.pick).toBeNull();
  });
});
