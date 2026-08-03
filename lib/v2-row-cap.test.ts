// #V2-ROW-CAP-0803 — il tetto di righe di /api/v2/predictions, e il fatto che
// non debba più essere silenzioso.
//
// Storia del difetto, perché questi test esistano per una ragione e non per
// simmetria: la query aveva `LIMIT 100` scritto dentro. È rimasto invisibile
// finché il filtro di coverage scartava quasi tutto il football — le righe
// buttate lasciavano spazio sotto il tetto. Chiuso #V2-FOOTBALL-COVERAGE-0802
// le righe hanno cominciato a passare tutte, e il tetto ha iniziato a mordere:
// misurato il 2026-08-03, 139 righe in finestra (75 tennis + 64 football) di
// cui v2 ne restituiva 100 tonde. Nessun errore, nessun log: un `count` uguale
// al limite è indistinguibile da "ci sono esattamente 100 partite".
//
// Il 27/07 lo stesso difetto era stato stimato in "13 partite tagliate" e
// archiviato come non-blocker. Era diventato 39.
import { describe, it, expect } from "vitest";
import { V2_MAX_ROWS, isRowCapReached, PREDICTION_WINDOW_DAYS } from "./prediction-window";

describe("v2: tetto di righe lette dal DB", () => {
  it("il tetto ha margine sul volume reale misurato in finestra", () => {
    // 139 righe grezze il 2026-08-03 — e quel giorno il calendario dei club era
    // ancora fermo (Liga 15/08, PL 21/08, Serie A 22/08, Bundesliga 28/08),
    // quindi è il MINIMO stagionale, non il caso normale. Il tetto deve reggere
    // il picco a stagione piena, non il vuoto d'agosto.
    const volumeMisuratoAlMinimoStagionale = 139;
    expect(V2_MAX_ROWS).toBeGreaterThan(volumeMisuratoAlMinimoStagionale * 5);
  });

  it("resta un tetto: non è illimitato", () => {
    // La WHERE è già selettiva (finestra, published, non storica, non demo), ma
    // una lettura senza limite su una tabella che cresce è un'altra categoria
    // di rischio. Il tetto c'è, è solo dimensionato onestamente.
    expect(Number.isFinite(V2_MAX_ROWS)).toBe(true);
    expect(V2_MAX_ROWS).toBeLessThanOrEqual(5000);
  });

  it("segnala il troncamento quando la lettura tocca il tetto", () => {
    expect(isRowCapReached(V2_MAX_ROWS)).toBe(true);
  });

  it("segnala anche se il driver restituisse più del tetto", () => {
    // Difensivo: `>=`, non `===`. Un `===` mancherebbe il caso e tornerebbe al
    // silenzio, che è il difetto che stiamo chiudendo.
    expect(isRowCapReached(V2_MAX_ROWS + 1)).toBe(true);
  });

  it("non segnala nulla sotto il tetto", () => {
    expect(isRowCapReached(V2_MAX_ROWS - 1)).toBe(false);
    expect(isRowCapReached(139)).toBe(false); // il volume reale di oggi
    expect(isRowCapReached(0)).toBe(false);   // board vuoto: è un altro problema, non un troncamento
  });

  it("la finestra di pubblicazione resta quella di #019", () => {
    // Il tetto è dimensionato SU questa finestra: se un domani la finestra si
    // allarga, il volume cresce e il tetto va rivisto. Questo test lega le due
    // cose, così la modifica di una fa rileggere l'altra.
    expect(PREDICTION_WINDOW_DAYS).toBe(10);
  });
});
