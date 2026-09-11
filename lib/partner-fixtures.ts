// #PARTNER-INGEST-0911 (APPROVE Andrea) — le partite dei partner diventano
// righe servibili, invece di restare quote in cerca di una partita.
//
// ─── Il problema ───────────────────────────────────────────────────────────
// Il board mostrava 11 partite di tennis contro 198 di calcio. Non perche' i
// partner non ce le diano: misurato sul feed vivo l'11/09, FortunePlay e YBets
// (stessa piattaforma BetConstruct) portano **108 partite di tennis, 81 future,
// 106 con quote** — sette volte quelle pubblicate. Le ricevevamo a ogni giro e
// ne tenevamo solo un hash, buono ad AGGANCIARE una partita gia' nota e non a
// SCOPRIRNE una nuova (#PARTNER-FIXTURES-0911 ha smesso di gettare nomi e
// orari; questo file li usa).
//
// ─── Perche' passa da `tennis_predictions` e non dal board ──────────────────
// Perche' quella porta esiste gia' e tutto il resto e' gia' costruito dietro:
// l'adapter, il floor segment-aware, il gate di pubblicazione, il settlement.
// Scrivere direttamente in `unified_predictions` avrebbe scavalcato quattro
// controlli che qualcuno ha scritto apposta — e ogni riga che entra da una
// porta di servizio e' una riga che nessuno di quei controlli protegge.
//
// ─── L'onesta' della riga prodotta (regola P0 del progetto) ────────────────
// La probabilita' e' il MERCATO devigato, `edge` resta NULL. Non abbiamo un
// modello per questi giocatori: dichiarare un edge sarebbe inventarlo. E' lo
// stesso contratto delle righe market-anchored gia' in produzione
// (#TENNIS-MARKET-ANCHOR-0821), quindi queste righe ereditano anche la
// correzione del winner's curse (#CURSE-ANCHORED-0911) — che e' il motivo per
// cui quella correzione andava fatta PRIMA di aprire questo rubinetto:
// moltiplicare per sette righe che dichiarano 68% e ne fanno 62% avrebbe
// moltiplicato l'errore, non la copertura.
//
// ─── Cosa NON fa ───────────────────────────────────────────────────────────
// Non tocca le righe che il modello produce gia': l'upsert scrive solo se la
// partita non esiste, e non sovrascrive mai `p1/p2` di una riga con un Elo
// vero. Il partner riempie i buchi, non prende il posto del modello.

import { fetchAllBooks } from "./betconstruct-feed";
import type { FpMatch } from "./fortuneplay-live";
import { dbQuery } from "./db";

/** Quanto lontano nel futuro accettiamo una partita del partner. */
const ORIZZONTE_GIORNI = 10; // allineato a PREDICTION_WINDOW_DAYS

export type FixturePartner = {
  matchId: string;
  player1: string;
  player2: string;
  scheduledAt: string;
  p1: number;
  p2: number;
  oddsP1: number;
  oddsP2: number;
};

/**
 * De-vig a due vie: toglie il margine del bookmaker normalizzando le due
 * probabilita' implicite.
 *
 * Il metodo proporzionale e' il piu' semplice e NON e' neutro: se il book
 * carica piu' margine sull'outsider, il favorito resta un filo sovrastimato.
 * Lo accettiamo consapevolmente perche' il residuo e' gia' coperto a valle —
 * #CURSE-ANCHORED-0911 corregge queste stesse righe su dati osservati, che e'
 * una misura piu' affidabile di qualunque modello di margine assunto a priori.
 */
export function devig2vie(o1: number, o2: number): { p1: number; p2: number } | null {
  if (!(o1 > 1) || !(o2 > 1)) return null;
  const i1 = 1 / o1;
  const i2 = 1 / o2;
  const s = i1 + i2;
  if (!(s > 0) || !Number.isFinite(s)) return null;
  return { p1: i1 / s, p2: i2 / s };
}

/**
 * Da partita del partner a fixture servibile. `null` = si scarta, e ogni
 * motivo di scarto e' una condizione che renderebbe la riga non pubblicabile
 * o non verificabile.
 */
export function fixtureDaPartner(m: FpMatch, adesso = Date.now()): FixturePartner | null {
  if (m.sport !== "tennis") return null;
  if (!m.homeName || !m.awayName) return null;
  if (!m.startTime) return null; // senza orario non si settla e non si ordina

  const quando = Date.parse(m.startTime);
  if (!Number.isFinite(quando)) return null;
  // Gia' iniziata: la pubblicheremmo come futura e sarebbe falso. Oltre
  // l'orizzonte: fuori dalla finestra di pubblicazione (#019).
  if (quando <= adesso) return null;
  if (quando > adesso + ORIZZONTE_GIORNI * 86_400_000) return null;

  // Il tennis e' testa a testa: senza ENTRAMBI i prezzi non c'e' de-vig, e
  // senza de-vig non c'e' una probabilita' onesta da servire.
  if (m.oddsHome == null || m.oddsAway == null) return null;
  const p = devig2vie(m.oddsHome, m.oddsAway);
  if (!p) return null;

  return {
    // Prefisso esplicito: l'origine di una riga deve restare leggibile nel dato,
    // non solo nei log. `teamPairKey` porta gia' data e nomi normalizzati, quindi
    // due book che mandano la stessa partita producono lo STESSO id e l'upsert
    // li fonde invece di duplicarli.
    //
    // #PARTNER-DEDUP-0911 — i due punti dentro la chiave vanno sostituiti, e
    // non e' cosmesi. `app/api/tennis/route.ts` deduplica le righe con
    //   DISTINCT ON (split_part(match_id, ':', 3))
    // cioe' prende il TERZO segmento dell'id. Per `tennis:rapidapi:12345`
    // quello e' l'identificativo; per `tennis:partner:2026-09-12:tizio|caio`
    // sarebbe **la data**, e tutte le partite partner dello stesso giorno si
    // collasserebbero in una sola riga. Misurato in produzione: 74 righe
    // scritte, **2** servite dal board.
    // Con `_` al posto di `:` il terzo segmento torna a essere l'intera chiave
    // — data e nomi insieme — quindi univoco per partita.
    matchId: `tennis:partner:${m.teamPairKey.replace(/:/g, "_")}`,
    player1: m.homeName,
    player2: m.awayName,
    scheduledAt: new Date(quando).toISOString(),
    p1: p.p1,
    p2: p.p2,
    oddsP1: m.oddsHome,
    oddsP2: m.oddsAway,
  };
}

export type EsitoIngest = {
  vistiDalPartner: number;
  candidati: number;
  scritti: number;
  scartati: number;
};

/**
 * Legge i book partner e deposita le partite di tennis mancanti in
 * `tennis_predictions`. Da li' in poi la pipeline esistente fa il resto.
 */
export async function ingestPartnerTennis(adesso = Date.now()): Promise<EsitoIngest> {
  const esito: EsitoIngest = { vistiDalPartner: 0, candidati: 0, scritti: 0, scartati: 0 };

  // `fetchAllBooks` torna un array di { book, map }, dove `map` e' indicizzata
  // per teamPairKey — non un oggetto piatto. Un book che fallisce restituisce
  // una mappa vuota e non ferma gli altri (contratto di betconstruct-feed).
  const perBook = await fetchAllBooks();
  // Due book sulla stessa piattaforma mandano le stesse partite: si fondono
  // sul matchId prima di toccare il database.
  const unici = new Map<string, FixturePartner>();
  for (const { map } of perBook) {
    for (const m of map.values()) {
      esito.vistiDalPartner += 1;
      const f = fixtureDaPartner(m, adesso);
      if (!f) {
        esito.scartati += 1;
        continue;
      }
      if (!unici.has(f.matchId)) unici.set(f.matchId, f);
    }
  }
  esito.candidati = unici.size;

  for (const f of unici.values()) {
    // ON CONFLICT DO NOTHING e' deliberato, non pigrizia: se la partita esiste
    // gia' — perche' il modello l'ha prodotta con un Elo vero, o per un giro
    // precedente — le sue probabilita' valgono piu' di una copia del mercato,
    // e sovrascriverle sarebbe una regressione silenziosa.
    //
    // I tre campi del conflitto sono quelli dell'indice VERO
    // (`uq_tennis_predictions_match` su match_id + player1 + player2), letto
    // da `pg_indexes` e non dedotto: con `ON CONFLICT (match_id)` da solo
    // Postgres non trova un vincolo corrispondente e la query fallisce a ogni
    // riga, in produzione.
    const r = await dbQuery(
      `INSERT INTO tennis_predictions
         (match_id, tournament, surface, player1, player2, scheduled_at,
          p1, p2, odds_p1, odds_p2, edge, best_selection, model_version, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,NOW())
       ON CONFLICT (match_id, player1, player2) DO NOTHING
       RETURNING match_id`,
      [
        f.matchId,
        "Partner feed",
        "hard", // il feed non dichiara la superficie; 'hard' e' il default del parser
        f.player1,
        f.player2,
        f.scheduledAt,
        Math.round(f.p1 * 10000) / 10000,
        Math.round(f.p2 * 10000) / 10000,
        f.oddsP1,
        f.oddsP2,
        f.p1 >= f.p2 ? "P1" : "P2",
        "partner-market-v1",
      ],
    ).catch((e: unknown) => {
      console.error("[partner-ingest] errore su", f.matchId, String(e));
      return [] as unknown[];
    });
    if (Array.isArray(r) && r.length > 0) esito.scritti += 1;
  }

  console.log(
    `[partner-ingest] tennis: visti ${esito.vistiDalPartner}, candidati ${esito.candidati}, ` +
      `nuovi ${esito.scritti}, scartati ${esito.scartati}`,
  );
  return esito;
}
