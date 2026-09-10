// #BOARD-ODDS-JOIN-0910 — passo 2 di #BOARD-ODDS-GATE-0910 (APPROVE Andrea 10/09).
//
// Il passo 1 ha smesso di NASCONDERE le predizioni che nessun book partner
// prezzava: il board e' passato da 55 a 120 partite di calcio. Quelle 65 righe
// recuperate pero' si vedono SENZA prezzo, perche' la quota si cerca con una
// chiave a uguaglianza esatta (`data:normName(home)|normName(away)`) e i nomi
// divergono: `normName` toglie `FC|CF|SC|AC|AS|SV|SS|US|SSC|Calcio` ma non
// `ACF`, `CFC`, `BC`, `1907`, `1913`, e non riconcilia «Internazionale Milano»
// con «Inter».
//
// Qui il prezzo si ritrova con un fallback a token, con le stesse due cautele
// di `odds-join.ts`:
//   1. si cerca SOLO fra le partite dello STESSO GIORNO. Non e' un'ottimizzazione
//      di comodo: due squadre possono incontrarsi piu' volte nella stagione, e
//      cercare su tutto il feed vorrebbe dire attaccare il prezzo di un'altra
//      giornata. Riduce anche il lavoro da ~890 confronti per riga a ~110.
//   2. la candidata deve essere UNICA. Se piu' di una combacia, nessuna: un
//      prezzo sbagliato e' peggio di un prezzo mancante, perche' l'utente ci
//      scommette sopra.
//
// Solo CALCIO. Il tennis usa `canonicalPlayerKey` (cognomi) e un matcher a token
// sui nomi dei giocatori ragiona in modo diverso: non si tocca senza misurarlo.

import { matchModelTeam } from "./summer-leagues";
// La chiave esatta NON si ricostruisce a mano: la costruisce `teamPairKey`, che
// ORDINA alfabeticamente i due nomi (`[ka, kb].sort()`). Riscriverla qui come
// `home|away` faceva mancare l'accesso esatto su meta' delle partite — bug
// trovato leggendo il costruttore prima di collegare questo file, non dopo.
import { teamPairKey } from "./team-pair-key";

export type QuotaPartner = { homeKey: string; awayKey: string };

/** Indice per giorno, costruito una volta sola: la mappa arriva chiavata
 *  `YYYY-MM-DD:home|away`, quindi il giorno e' il prefisso fino ai due punti. */
export function indicizzaPerGiorno<T extends QuotaPartner>(
  quote: Record<string, T> | null | undefined,
): Map<string, T[]> {
  const indice = new Map<string, T[]>();
  if (!quote) return indice;
  for (const [chiave, voce] of Object.entries(quote)) {
    const giorno = chiave.slice(0, chiave.indexOf(":"));
    if (giorno.length !== 10) continue;
    const lista = indice.get(giorno);
    if (lista) lista.push(voce);
    else indice.set(giorno, [voce]);
  }
  return indice;
}

export type EsitoQuota<T> = {
  quota: T | null;
  via: "esatto" | "token" | "ambiguo" | "nessuna";
};

export function abbinaQuotaPartner<T extends QuotaPartner>(
  home: string | null | undefined,
  away: string | null | undefined,
  kickoffIso: string | null | undefined,
  quote: Record<string, T> | null | undefined,
  indicePerGiorno: Map<string, T[]>,
): EsitoQuota<T> {
  if (!home || !away || !kickoffIso || !quote) return { quota: null, via: "nessuna" };
  const giorno = kickoffIso.slice(0, 10);
  if (giorno.length !== 10) return { quota: null, via: "nessuna" };

  const chiave = teamPairKey("soccer", home, away, kickoffIso);
  const esatta = chiave ? quote[chiave] : undefined;
  if (esatta) return { quota: esatta, via: "esatto" };

  const delGiorno = indicePerGiorno.get(giorno);
  if (!delGiorno || delGiorno.length === 0) return { quota: null, via: "nessuna" };

  const candidate = delGiorno.filter(
    (v) =>
      matchModelTeam(v.homeKey, [home]) !== null &&
      matchModelTeam(v.awayKey, [away]) !== null,
  );
  if (candidate.length === 1) return { quota: candidate[0], via: "token" };
  if (candidate.length > 1) return { quota: null, via: "ambiguo" };
  return { quota: null, via: "nessuna" };
}
