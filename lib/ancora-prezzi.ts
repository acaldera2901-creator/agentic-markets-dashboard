// #ANCORA-CHIUSURA-0917 — l'ultimo prezzo prima del fischio.
//
// `prediction_log` ha gia' la storia del prezzo dell'ancora (~90 punti per
// partita sul calcio, dal 06/06). Quello che non ha e' la CODA: il suo writer
// e' `/api/predictions`, chiamato dal cron ogni 2 ore, quindi l'ultima
// osservazione prima del fischio cade uniformemente fra 0 e 120 minuti. Solo
// l'1,8% delle partite ha un prezzo entro 15 minuti dal via (misurato il 17/09
// su 391 partite). Questo modulo raccoglie solo quella coda.
//
// Due scelte di costo, entrambe deliberate:
//   * si guarda PRIMA il nostro database. Se non c'e' nessuna partita dentro la
//     finestra, la funzione esce senza toccare l'Odds API: zero crediti nei
//     giri vuoti, che sono la maggioranza;
//   * si riusa `fetchOdds`, quindi si eredita la guardia di quota
//     (`oddsBudgetOk`) e la selezione del book gia' in produzione. Un secondo
//     percorso di lettura delle quote sarebbe un secondo posto in cui
//     sbagliare.
import { fetchOdds, normName, SPORT_KEYS } from "@/lib/odds-api";
import { teamPairKey } from "@/lib/team-pair-key";
import { dbQuery } from "@/lib/db";

// Quanto prima del fischio si inizia a raccogliere. 75 minuti con un giro ogni
// 10 coprono ~7 catture per partita: abbastanza per avere un ultimo punto
// vicino al via anche se un giro salta.
export const FINESTRA_MIN = 75;

export type EsitoAncora = {
  partiteImminenti: number;
  legheInterrogate: number;
  abbinate: number;
  scritte: number;
  fallite: number;
  chiamateOddsApi: number;
};

type PartitaImminente = {
  league: string;
  home_team: string;
  away_team: string;
  starts_at: string;
};

/** Le partite che stanno per cominciare, lette dal NOSTRO database. */
export async function partiteInFinestra(
  adesso = Date.now(),
  finestraMin = FINESTRA_MIN
): Promise<PartitaImminente[]> {
  const da = new Date(adesso).toISOString();
  const a = new Date(adesso + finestraMin * 60_000).toISOString();
  return dbQuery<PartitaImminente>(
    `SELECT DISTINCT league, home_team, away_team, starts_at
       FROM unified_predictions
      WHERE sport = 'football'
        AND starts_at > $1 AND starts_at <= $2
        AND league IS NOT NULL`,
    [da, a]
  );
}

/**
 * Registra il prezzo dell'ancora per le partite imminenti.
 *
 * Fail-soft per contratto: un errore qui non deve rompere un cron che gira
 * ogni dieci minuti.
 */
export async function registraPrezzoAncora(
  adesso = Date.now()
): Promise<EsitoAncora> {
  const esito: EsitoAncora = {
    partiteImminenti: 0, legheInterrogate: 0, abbinate: 0,
    scritte: 0, fallite: 0, chiamateOddsApi: 0,
  };

  let partite: PartitaImminente[] = [];
  try {
    partite = await partiteInFinestra(adesso);
  } catch {
    return esito;
  }
  esito.partiteImminenti = partite.length;
  if (partite.length === 0) return esito; // giro vuoto: nessun credito speso

  // Una chiamata per lega, non per partita: due partite della stessa lega
  // costerebbero due crediti per lo stesso payload.
  const perLega = new Map<string, PartitaImminente[]>();
  for (const p of partite) {
    if (!SPORT_KEYS[p.league]) continue; // lega senza chiave: niente da chiedere
    const v = perLega.get(p.league) ?? [];
    v.push(p);
    perLega.set(p.league, v);
  }
  esito.legheInterrogate = perLega.size;

  for (const [league, suoi] of perLega) {
    let quote;
    try {
      esito.chiamateOddsApi += 1;
      quote = await fetchOdds(league);
    } catch {
      continue;
    }
    if (!quote?.length) continue;

    // L'abbinamento parte dalla NOSTRA partita: e' lei a portare la data, che
    // `OddsResult` non ha. La chiave si costruisce con `teamPairKey`, non a
    // mano.
    const perNomi = new Map(quote.map((q) => [`${q.homeNorm}|${q.awayNorm}`, q]));

    for (const p of suoi) {
      const q =
        perNomi.get(`${normName(p.home_team)}|${normName(p.away_team)}`) ??
        perNomi.get(`${normName(p.away_team)}|${normName(p.home_team)}`);
      if (!q) continue;

      const chiave = teamPairKey("soccer", p.home_team, p.away_team, p.starts_at);
      if (!chiave) continue;

      const via = Date.parse(p.starts_at);
      if (!Number.isFinite(via)) continue;

      esito.abbinate += 1;
      try {
        await dbQuery(
          `INSERT INTO anchor_price_history
             (team_pair_key, sport, league, home_name, away_name, bookmaker,
              overround, odds_home, odds_draw, odds_away, commence_time,
              captured_at, minuti_al_via)
           VALUES ($1,'football',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            chiave, league, p.home_team, p.away_team, q.bookmaker,
            q.margin, q.oddsHome, q.oddsDraw, q.oddsAway,
            new Date(via).toISOString(),
            new Date(adesso).toISOString(),
            Math.round((via - adesso) / 60_000),
          ]
        );
        esito.scritte += 1;
      } catch {
        esito.fallite += 1;
      }
    }
  }

  return esito;
}
