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
