// #CONF-MARGINE-0910 — confidenza e stake suggerito, derivati dal MARGINE
// INTERNO della nostra pick e non dall'edge di mercato.
//
// Il difetto che questo file chiude: `confidenceFromEdge` faceva
// `edgeScore = edge * 700`, fino a 45 dei 95 punti di confidenza, dove `edge` e'
// la distanza fra la probabilita' servita e il prezzo de-viggato. Ma quella
// distanza SI RESTRINGE PER COSTRUZIONE quando il blend pesa il mercato — il
// commento in `lib/poisson-model.ts` lo dice a chiare lettere: «true edge over
// the close ≈ 0». Conseguenza: piu' il blend migliorava la CALIBRAZIONE, piu' la
// «confidenza» mostrata all'utente SCENDEVA. Due numeri che si muovevano al
// contrario, e nessuno lo aveva notato perche' alpha non era mai stato spostato.
//
// Il driver giusto e' di quanto la pick stacca il SECONDO esito. E' un numero
// nostro, non dipende dal prezzo di nessun bookmaker, dice esattamente cio' che
// la parola «confidenza» promette, e resta stabile al variare di alpha.
//
// Scala scelta per conservare la forma precedente: l'edge saturava i 45 punti a
// 6,4% (0,064 × 700); il margine li satura a 37,5 punti, che e' un favorito
// netto (es. 68% contro 30%).

/** Margine in PUNTI fra la pick e il secondo esito (come `modelEdge`). */
export function confidenceFromMargin(
  marginePt: number | null,
  probability: number,
): number {
  const marginScore = Math.min(45, Math.max(0, (marginePt ?? 0) * 1.2));
  const probScore = Math.min(35, Math.max(0, (probability - 0.35) * 100));
  return Math.round(Math.min(95, 20 + marginScore + probScore));
}

export function stakeFromMargin(
  marginePt: number | null,
  confidence: number,
): number {
  // Nessun margine = nessun favorito netto = nessuna puntata suggerita.
  if (!marginePt || marginePt <= 0) return 0;
  return Math.min(25, Math.max(2, Math.round((marginePt / 100) * confidence * 3) / 2));
}

/** Il margine dalle tre probabilita' 1X2 (o dalle due del tennis). */
export function margineDaProbabilita(...probabilita: Array<number | null | undefined>): number | null {
  const ordinate = probabilita
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    .sort((a, b) => b - a);
  if (ordinate.length < 2) return null;
  return Math.round((ordinate[0] - ordinate[1]) * 1000) / 10;
}
