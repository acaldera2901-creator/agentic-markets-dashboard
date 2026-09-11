// #CURSE-ANCHORED-0911 (APPROVE Andrea) — la correzione del winner's curse
// sulle righe tennis MARKET-ANCHORED, e SOLO su quelle.
//
// ─── Cosa si corregge, e perche' non e' il modello ─────────────────────────
// Il tennis serve due cose diverse sotto la stessa veste. Dove esiste un
// mercato e non un edge calcolato (`edge = null`, righe dette market-anchored)
// la probabilita' mostrata e' il MERCATO devigato; altrove e' il nostro Elo.
// Misurato su 1.421 pick concluse (04/06 -> 11/09):
//
//   market-anchored  n=911   dichiarato 68,1%   ottenuto 62,2%   -5,9pt  z=-3,94
//   modello nostro   n=510   dichiarato 68,5%   ottenuto 72,0%   +3,5pt  nel rumore
//
// Il nostro modello sta bene. Il guasto e' tutto dove pubblichiamo il mercato,
// e la causa NON e' il de-vig: se lo fosse, l'errore crescerebbe col favorito,
// mentre sale fino al 75-80% e poi **si inverte** sopra l'85%. E' un **bias di
// selezione**: pubblichiamo solo sopra il floor, e chi supera una soglia su una
// stima rumorosa tende ad averla superata anche grazie al rumore (winner's
// curse). La prova: le righe SOTTO il floor mostrano il bias speculare.
//
// ─── Perche' SOLO sulle ancorate ───────────────────────────────────────────
// Perche' una correzione uniforme e' stata misurata e FA DANNO. Con t=1,22 su
// tutto, sul holdout: market-anchored da -5,4 a -2,3pt (ripara), modello nostro
// da +3,5 a **+6,5pt con z=+2,33** (rompe, e lo rende significativo).
// L'aggregato sembrava migliorare (-2,0 -> +1,1) e nascondeva entrambe le cose:
// un aggregato su due popolazioni non descrive nessuna delle due.
//
// ─── Come e' stato scelto 1.68 ─────────────────────────────────────────────
// Griglia 0.80-2.40 con **split temporale**: stimato sul primo mezzo campione
// (04/06 -> 20/07), giudicato sul secondo (20/07 -> 11/09). L'ottimo cade a
// 1.68, DENTRO la griglia — un primo tentativo con griglia fino a 1.60 si era
// fermato al bordo, e una stima al bordo non e' una stima, e' un «almeno».
//
// ─── Cosa e' dimostrato, e cosa no ─────────────────────────────────────────
// ACCURATEZZA: non dimostrata. Differenza appaiata +0.00336 di Brier, IC 95%
// [-0.00063, +0.00736]. Il Brier sul holdout migliora (0.21033 -> 0.20725) ma
// l'intervallo contiene lo zero: questo file non sostiene di prevedere meglio.
// CALIBRAZIONE: dimostrata, sul holdout. Da -5,9pt con z=-2,94 (sovra-confidenza
// significativa) a +1,5pt con z=+0,70 (indistinguibile da zero).
//
// ─── L'effetto, detto senza addolcirlo ─────────────────────────────────────
// Le percentuali delle schede market-anchored SCENDONO di **6,30 punti** in
// media (mediana -6,02, punta -11,40). E' molto, ed e' il punto: un 72% che
// vince il 67% delle volte non e' un numero migliore di un 65% che vince il
// 67% — e' un numero falso. Le righe col nostro modello non si muovono di un
// millimetro.
//
// Rollback: TENNIS_ANCHORED_TAU = 1.0, identita' esatta.

/**
 * Temperatura delle righe tennis market-anchored. 1.0 = identita' (rollback).
 * NON si applica alle righe con un edge del modello: quelle sono calibrate.
 */
export const TENNIS_ANCHORED_TAU = 1.68;

/**
 * Temperatura su una probabilita' BINARIA (il tennis ha due esiti).
 *
 *   p' = p^(1/t) / ( p^(1/t) + (1-p)^(1/t) )
 *   t > 1  schiaccia verso il 50% (cura la sovra-confidenza)
 *   t < 1  rende la previsione piu' decisa
 *
 * Monotona per costruzione: non puo' invertire chi e' il favorito, quindi
 * corregge QUANTO siamo sicuri e mai DI CHI.
 */
export function applyTennisTemperature(
  p: number,
  tau: number = TENNIS_ANCHORED_TAU,
): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return p; // 0, 1 e i non-numeri restano
  if (tau === 1.0) return p;
  if (!(tau > 0) || !Number.isFinite(tau)) return p; // fail-safe: tau invalido = identita'
  const a = Math.pow(p, 1 / tau);
  const b = Math.pow(1 - p, 1 / tau);
  const s = a + b;
  if (!(s > 0) || !Number.isFinite(s)) return p;
  return a / s;
}

/**
 * La probabilita' da MOSTRARE per una riga tennis.
 *
 * @param p               probabilita' del lato scelto, come arriva dal modello
 *                        o dal mercato devigato
 * @param haEdgeDelModello true se la riga porta un edge calcolato da noi: in
 *                        quel caso la probabilita' e' del nostro Elo, che e'
 *                        calibrato, e non va toccata.
 */
export function probabilitaMostrata(p: number, haEdgeDelModello: boolean): number {
  return haEdgeDelModello ? p : applyTennisTemperature(p);
}
