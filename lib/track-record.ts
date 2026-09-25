// #HITRATE-GUARD-1 (copy audit 2026-06-11, Andrea: anchor comms to sustainable
// rates, never small-sample spikes like the 93.8% football day-one figure).
//
// A published hit-rate is a CLAIM. Below this many decided picks (won+lost) the
// percentage is variance, not signal — at 4 settled matches a 75% reads like a
// promise the next weekend will break. Until the threshold is met the UI shows
// the raw record (X won · Y lost) and no percentage, everywhere a rate renders:
// WC TrackRecordStrip, History KPIs, desk header KPI, house banners.
// Sustainable anchors (walk-forward held-out): WC ~64-67%, club ~70%,
// friendlies ~74%, qualifiers ~75%, tennis ~72%.
export const MIN_DECIDED_FOR_RATE = 15;

export function isRateMeaningful(decided: number): boolean {
  return Number.isFinite(decided) && decided >= MIN_DECIDED_FOR_RATE;
}

// #SETTLE-0909 — LE DUE SOGLIE SONO DUE DECISIONI DIVERSE, non un doppione.
// Vanno dichiarate qui insieme, o il prossimo che le trova ne allinea una
// all'altra convinto di riparare un bug — ed e' esattamente cosi' che nasce un
// numero che nessuno ha deciso.
//
//   · MIN_DECIDED_FOR_RATE = 15 — la soglia di DISPLAY, per ogni percentuale
//     secondaria: un segmento, una striscia, un banner. Scelta nell'audit copy
//     dell'11/06 con Andrea: sotto i 15 esiti la percentuale e' varianza.
//
//   · MIN_SAMPLE = 30 in app/api/v2/history/route.ts — la soglia del CLAIM
//     PRINCIPALE, il numero che il prodotto mette in testa alla pagina come
//     track record. Piu' alta di proposito: e' l'unica cifra che un cliente
//     ricorda, e sopra quella soglia l'intervallo di Wilson e' abbastanza
//     stretto da non essere fuorviante.
//
// Quindi: un segmento con 20 esiti mostra la sua percentuale, l'headline no.
// Se una delle due va cambiata, si cambia con una decisione, non per simmetria.

// ─── #EDGE-SELETTIVITA-0917 ──────────────────────────────────────────────────
//
// LA TERZA SOGLIA, e non e' della stessa famiglia delle due qui sopra: quelle
// dicono QUANDO una percentuale si puo' pubblicare, questa dice SU QUALI PICK
// si puo' dire «Edge».
//
// Il fatto che la rende necessaria. #PICK-SEMPRE-0911 ha spento i floor: ogni
// partita porta una pick, e il track record e' passato da 65,1% a 59,6%. Non e'
// un peggioramento del modello — e' un cambio di popolazione. Misurato il 17/09
// sulle righe pubblicate (2.880 dopo dedup, letture read-only):
//
//   confidenza   [0,50)  40,7% · [50,56) 57,0% · [56,62) 60,1%
//                [62,70) 63,0% · [70,80) 69,9% · [80,100] 86,5%
//
// La monotonia regge sul DATO LIVE, non su un backtest: e' la stessa cosa che
// il lab aveva trovato il 08/06 (calibrazione + selettivita'), qui confermata su
// quello che abbiamo davvero servito. Alla soglia 62:
//
//   football  >=62: 77,0% (n=204)  ·  <62: 44,7% (n=996)   → +32,3 punti
//   tennis    >=62: 69,2% (n=951)  ·  <62: 60,6% (n=513)   →  +8,6 punti
//
// PERCHE' 62 E NON UN ALTRO NUMERO: e' il floor gia' deciso e gia' scritto per
// il tennis di alta fascia e per la UEFA Nations League in lib/surfacing-gate.ts
// (SURFACE_FLOOR_TENNIS, SURFACE_FLOOR_NATIONS_UEFA). Non si inventa una soglia
// nuova per una nuova etichetta: se ne riusa una che qualcuno ha gia' deciso, o
// fra un mese ce ne sono tre che nessuno sa piu' distinguere.
//
// PROBABILITY-NEUTRAL: questa soglia NON filtra cosa si serve e non tocca
// nessuna probabilita'. Separa soltanto, dentro il track record, le pick su cui
// dichiariamo un vantaggio da quelle che pubblichiamo comunque.
export const EDGE_MIN_CONFIDENCE = 62;

export function isEdgePick(confidence: number | null | undefined): boolean {
  return typeof confidence === "number"
    && Number.isFinite(confidence)
    && confidence >= EDGE_MIN_CONFIDENCE;
}

export type EdgeTally = {
  /** Pick con confidenza >= EDGE_MIN_CONFIDENCE e un esito. */
  n: number;
  won: number;
  lost: number;
  /** Quota di volume: quante delle pick decise portano l'etichetta. */
  share: number | null;
  /** null sotto MIN_DECIDED_FOR_RATE: una percentuale su 4 esiti non e' un dato. */
  win_rate: number | null;
};

/**
 * Conta le pick «Edge» fra righe gia' filtrate (mostrate + verificate).
 *
 * Funzione pura. Una riga senza confidenza NON e' Edge: l'assenza del dato non
 * si legge come se fosse sopra soglia — fail-closed, come il resto del gate.
 */
/**
 * #TRE-LIVELLI-0925 — il conteggio di una popolazione qualsiasi di righe chiuse.
 *
 * Serve a pubblicare, accanto al numero in testa alla pagina, le popolazioni che
 * dal numero sono state ESCLUSE (la «lettura del modello» e la «sola lettura»
 * del calcio). Senza questo, l'esclusione sarebbe silenziosa: una percentuale
 * che sale perche' qualcuno ha ristretto il denominatore, e nessun modo per chi
 * legge di accorgersene.
 *
 * Funzione pura. `win_rate` resta null sotto MIN_DECIDED_FOR_RATE, per la stessa
 * ragione di edgeTally: una percentuale su pochi esiti non e' un dato.
 */
export function outcomeTally(
  rows: { result?: string | null }[]
): { n: number; won: number; lost: number; win_rate: number | null } {
  const decise = rows.filter((r) => r.result === "won" || r.result === "lost");
  const won = decise.filter((r) => r.result === "won").length;
  return {
    n: decise.length,
    won,
    lost: decise.length - won,
    win_rate: isRateMeaningful(decise.length)
      ? Number(((won / decise.length) * 100).toFixed(1))
      : null,
  };
}

export function edgeTally(
  rows: { result?: string | null; confidence_score?: number | null }[]
): EdgeTally {
  const decise = rows.filter((r) => r.result === "won" || r.result === "lost");
  const edge = decise.filter((r) => isEdgePick(r.confidence_score));
  const won = edge.filter((r) => r.result === "won").length;
  const lost = edge.length - won;
  return {
    n: edge.length,
    won,
    lost,
    share: decise.length > 0 ? Number((edge.length / decise.length).toFixed(3)) : null,
    win_rate: isRateMeaningful(edge.length)
      ? Number(((won / edge.length) * 100).toFixed(1))
      : null,
  };
}
