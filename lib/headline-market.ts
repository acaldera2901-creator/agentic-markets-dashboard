// #HEADLINE-MARKET-0830 — quale mercato la card mette in testata.
//
// Nato da una card vera (Casa Pia v Moreirense, Primeira Liga, 30/08/2026):
// "MODEL READ · Casa Pia · 35% model". Andrea: «quello non è una probabilità,
// dobbiamo alzare questi numeri ma realmente».
//
// Il 35% NON era un difetto del modello. Quote Pinnacle devigate di quella
// partita: Casa Pia 33,9% · pareggio 30,8% · Moreirense 35,4%. Le tre sommano a
// 100 e stanno tutte attorno a un terzo: sull'1X2 non ESISTE un numero più alto
// da mostrare. Alzarlo sarebbe mentire, e il backtest del 30/08 misura quanto
// costa: la fascia con più edge dichiarato rende −8,44% (CI 95% [−12,14, −4,51]).
//
// Il problema non è che il motore prevede poco: è che gli chiediamo sempre la
// domanda più difficile. Su una partita in equilibrio «chi vince?» non ha una
// risposta forte; «chi non perde?» sì — e sugli stessi identici dati vale 64,6%.
//
// LA REGOLA, fissata prima di guardare i risultati:
//   favorito 1X2 >= HEADLINE_MIN_PROB  -> mostra quello, come sempre
//   altrimenti                          -> mostra la doppia chance più probabile
//
// Misurato su 297 partite con ancora valida: il numero mediano in testata passa
// da 48,5% a 72,1%, le righe sopra il 50% da 135 (45%) a 297 (100%), e le 48
// righe che mostravano meno del 40% passano da 37,4% a 72,2% di mediana.
//
// PERCHÉ È ONESTO
//  · Non è un modello nuovo: 1X = P(casa) + P(pareggio) viene dalla STESSA tripla
//    che serviamo già. Nessuna calibrazione aggiuntiva, nessuna ancora separata.
//  · La probabilità si somma dalla tripla SERVITA (blended col mercato), non da
//    `extra_markets`: quelli nascono dalle lambda del Poisson PRIMA del blend e
//    darebbero un numero incoerente col resto della card.
//  · La quota arriva solo da `extra_markets` quando è reale. Se manca, il campo
//    resta null: mai una quota derivata dalla probabilità.
//  · La scelta è per PROBABILITÀ, mai per edge — è la lezione di
//    lib/pick-selection.ts (#PICK-FAVOURITE-0812): sull'edge il modello
//    sovrastima i longshot e la selezione finiva sull'underdog a quota 9.
//
// Chi legge questo numero deve sapere di quale mercato è: la testata mostra
// SEMPRE l'etichetta accanto alla percentuale. Un 72% nudo è fuorviante.

/** Sopra questa probabilità il favorito 1X2 parla da sé. 0 = comportamento pre-0830. */
export const HEADLINE_MIN_PROB = 0.5;

export type HeadlineMarket = "h2h" | "double_1x" | "double_x2";
export type HeadlineSelection = "HOME" | "DRAW" | "AWAY" | "1X" | "X2";

export type HeadlineRead = {
  market: HeadlineMarket;
  selection: HeadlineSelection;
  /** Probabilità servita, sommata dalla tripla. Mai ricavata dalle quote. */
  prob: number;
  /** Quota reale del mercato, o null. Mai derivata dalla probabilità. */
  odds: number | null;
};

type Triple = {
  pHome: number | null | undefined;
  pDraw: number | null | undefined;
  pAway: number | null | undefined;
};

export function headlineRead(
  t: Triple,
  marketOdds: Partial<Record<string, number>> = {},
  minProb: number = HEADLINE_MIN_PROB,
): HeadlineRead | null {
  const { pHome, pDraw, pAway } = t;
  if (pHome == null || pDraw == null || pAway == null) return null;

  // Il favorito 1X2, esattamente come lo sceglie oggi favouritePick().
  const fav: { selection: HeadlineSelection; prob: number } =
    pHome >= pDraw && pHome >= pAway ? { selection: "HOME", prob: pHome }
    : pDraw >= pAway ? { selection: "DRAW", prob: pDraw }
    : { selection: "AWAY", prob: pAway };

  if (fav.prob >= minProb) {
    const key = fav.selection === "HOME" ? "home" : fav.selection === "DRAW" ? "draw" : "away";
    return { market: "h2h", selection: fav.selection, prob: fav.prob, odds: marketOdds[key] ?? null };
  }

  // Nessun favorito netto: la doppia chance più probabile dice di più, ed è vera
  // quanto la tripla da cui viene.
  //
  // "12" (uno dei due vince) è ESCLUSO di proposito, benché sia spesso il numero
  // più alto: su una partita equilibrata vale ~70% per costruzione e dice solo
  // «non finirà pari», senza indicare nessuna squadra. Sarebbe un numero grande e
  // vuoto — l'opposto di quello che questo lavoro deve ottenere. Restano 1X e X2,
  // che una squadra la nominano.
  const doppie: Array<{ market: HeadlineMarket; selection: HeadlineSelection; prob: number }> = [
    { market: "double_1x", selection: "1X", prob: pHome + pDraw },
    { market: "double_x2", selection: "X2", prob: pAway + pDraw },
  ];
  doppie.sort((a, b) => b.prob - a.prob);
  const scelta = doppie[0];
  return { ...scelta, odds: marketOdds[scelta.market] ?? null };
}
