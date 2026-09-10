// #BOARD-PICKS-0910 — l'abbinamento fixture ↔ quote, in un posto solo e testabile.
//
// Perché esiste: il board mostrava una direzione su 6 righe su 120, e la causa
// principale NON era il modello né il floor — era questo abbinamento. La chiave
// era l'uguaglianza esatta di `normName(home)|normName(away)`, e `normName`
// rimuove solo `FC|CF|SC|AC|AS|SV|SS|US|SSC|AFC|Calcio`: quindi `ACF Fiorentina`
// non uguagliava `Fiorentina`, `Genoa CFC` non uguagliava `Genoa`, e nelle 5
// leghe top 56 righe su 95 perdevano il prezzo PUR AVENDOLO disponibile
// sull'API (verificato con una GET read-only, 10/09).
//
// Un fallback a livello di token esisteva già, ma era chiuso dentro
// `if (!odds && isSummerLeague(code))`: i campionati che interessano non lo
// avevano. Qui vale per tutte le leghe.
//
// Due cose che il codice precedente NON faceva e che qui sono deliberate:
//
//  1. UNICITÀ. Il ciclo di prima prendeva il PRIMO candidato che combaciava
//     (`break`), non l'unico: con due partite dai nomi simili nella stessa
//     giornata l'accoppiamento era arbitrario e silenzioso. Qui, se più di una
//     candidata combacia, non si abbina NIENTE (`ambiguo`). Allargare il
//     fallback a tutte le leghe senza questo avrebbe allargato anche il rischio
//     di attaccare a una partita il prezzo di un'altra — cioè un dato sbagliato
//     al posto di un dato mancante, che è peggio.
//  2. L'ESITO È DICHIARATO. La funzione dice COME ha abbinato, così il chiamante
//     può contare quante righe passano da `esatto`, `token`, `ambiguo`,
//     `nessuna` e misurare il tasso di join invece di stimarlo.
//
// Limite noto e MISURATO, non dimenticato: le varianti di GRAFIA restano fuori.
// `bayern munich` (odds) e `bayern munchen` (fixture) condividono un token su
// due → sovrapposizione 0,5, sotto la soglia 0,6 di `matchModelTeam`. Il test
// `odds-join.test.ts` fissa questo caso come NON abbinato, di proposito: se un
// giorno servirà, la strada è una mappa alias esplicita, non abbassare la
// soglia (che aprirebbe a «Manchester United»/«Manchester City», oggi a 0,5).

import { normName } from "./odds-api";
import { matchModelTeam } from "./summer-leagues";

export type QuotaAbbinabile = { homeNorm: string; awayNorm: string };

export type EsitoAbbinamento<T> = {
  quota: T | null;
  /** `esatto` = chiave identica · `token` = fallback riuscito e UNICO ·
   *  `ambiguo` = più di una candidata, quindi nessuna · `nessuna` = zero. */
  via: "esatto" | "token" | "ambiguo" | "nessuna";
  candidate: number;
};

export function abbinaQuote<T extends QuotaAbbinabile>(
  home: string,
  away: string,
  quote: Record<string, T> | undefined,
): EsitoAbbinamento<T> {
  if (!quote) return { quota: null, via: "nessuna", candidate: 0 };

  const esatta = quote[`${normName(home)}|${normName(away)}`];
  if (esatta) return { quota: esatta, via: "esatto", candidate: 1 };

  const candidate = Object.values(quote).filter(
    (o) =>
      matchModelTeam(o.homeNorm, [home]) !== null &&
      matchModelTeam(o.awayNorm, [away]) !== null,
  );
  if (candidate.length === 1) return { quota: candidate[0], via: "token", candidate: 1 };
  if (candidate.length > 1) return { quota: null, via: "ambiguo", candidate: candidate.length };
  return { quota: null, via: "nessuna", candidate: 0 };
}
