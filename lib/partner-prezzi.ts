// #PREZZI-STORIA-0911 (APPROVE Andrea) — la storia dei prezzi sulle partite che
// pubblichiamo DAVVERO. E' l'impianto che rende misurabile tutto il resto.
//
// ─── Perche' esiste ────────────────────────────────────────────────────────
// Oggi non sappiamo se abbiamo un vantaggio sul mercato, e il motivo non e' che
// i segnali non esistano: e' che **manca il metro**. Misurato l'11/09, provando
// a rispondere alla domanda «dove nasce il nostro edge»:
//
//   * sei feature del modello (forma al servizio e in risposta, precedenti,
//     riposo, carico, affidabilita' di superficie) NON contengono informazione
//     residua rispetto al prezzo: tutte sotto |t| = 2 una volta condizionate
//     sul mercato. Il bookmaker le ha gia' dentro.
//   * il candidato piu' forte — il MOVIMENTO della linea — non si e' potuto
//     nemmeno testare: `odds_snapshots` ha 16,2 milioni di righe, e quasi
//     nessuna riguarda le partite che pubblichiamo. Il CLV ricostruito a
//     posteriori agganciava **17 pick su 74**.
//
// Sei test seri, uno solo concludibile. Non per mancanza di idee: per mancanza
// di dati agganciati.
//
// ─── Perche' ADESSO e' possibile ───────────────────────────────────────────
// Stamattina no: le chiusure multi-libro coprivano OTTO partite. Ora il feed
// partner porta ~844 partite a ogni giro, con `teamPairKey` gia' calcolato —
// la stessa chiave che usa `odds_snapshots`. L'aggancio non va inventato,
// va solo scritto.
//
// ─── Cosa NON fa ───────────────────────────────────────────────────────────
// Non decide niente e non tocca nessuna pick. Registra un prezzo e basta. Fra
// due settimane quei prezzi risponderanno a tre domande che oggi non hanno
// risposta: qual e' il nostro closing line value, se il movimento della linea
// distingue le pick buone da quelle obsolete, e se esiste un segmento dove
// battiamo la chiusura.
//
// Un impianto di misura che decide qualcosa smette di essere una misura.

import { fetchAllBooks } from "./betconstruct-feed";
import { dbExecute } from "./db";

/** Quanto in la' guardiamo: oltre, il prezzo non e' ancora informativo. */
const ORIZZONTE_GIORNI = 10;

/** Righe per INSERT: ~1.000 candidati diventano ~10 RPC invece di ~1.000. */
const BLOCCO = 100;

export type EsitoPrezzi = {
  vistiDalPartner: number;
  candidati: number;
  scartati: number;
  scritti: number;
  falliti: number;
  /** Righe non tentate perche' la scadenza era passata (#REFRESH-1001). */
  saltati: number;
};

/**
 * Registra un'istantanea dei prezzi partner in `odds_snapshots`.
 *
 * Ogni giro scrive una riga per partita e per book: e' la storia che permette
 * di ricostruire apertura, movimento e chiusura.
 */
export async function registraPrezziPartner(
  adesso = Date.now(),
  scadenza = Number.POSITIVE_INFINITY,
): Promise<EsitoPrezzi> {
  const esito: EsitoPrezzi = {
    vistiDalPartner: 0, candidati: 0, scartati: 0, scritti: 0, falliti: 0, saltati: 0,
  };

  const perBook = await fetchAllBooks();
  const daScrivere: {
    book: string; chiave: string; sport: string;
    casa: string; ospite: string; inizio: string;
    oddsHome: number; oddsAway: number; oddsDraw: number | null;
    minutiAlVia: number;
  }[] = [];

  for (const { book, map } of perBook) {
    for (const m of map.values()) {
      esito.vistiDalPartner += 1;
      // Si registra solo cio' che ha senso misurare: una partita futura, con
      // entrambi i prezzi e una chiave per ritrovarla.
      // Number.isFinite e non `!= null`: a blocchi, un NaN renderebbe invalida
      // l'INSERT intera e farebbe perdere tutte le righe del blocco.
      if (!m.teamPairKey || !m.startTime
          || !Number.isFinite(m.oddsHome) || !Number.isFinite(m.oddsAway)) {
        esito.scartati += 1;
        continue;
      }
      const quando = Date.parse(m.startTime);
      if (!Number.isFinite(quando) || quando <= adesso
          || quando > adesso + ORIZZONTE_GIORNI * 86_400_000) {
        esito.scartati += 1;
        continue;
      }
      daScrivere.push({
        book: book.key,
        chiave: m.teamPairKey,
        sport: m.sport,
        casa: m.homeName,
        ospite: m.awayName,
        inizio: new Date(quando).toISOString(),
        oddsHome: m.oddsHome as number,
        oddsAway: m.oddsAway as number,
        oddsDraw: Number.isFinite(m.oddsDraw) ? (m.oddsDraw as number) : null,
        // Minuti al fischio: e' LA dimensione su cui si legge un movimento di
        // linea. Calcolarlo qui, dove l'istante di cattura e' noto con
        // certezza, evita di dedurlo dopo da due colonne.
        minutiAlVia: Math.round((quando - adesso) / 60000),
      });
    }
  }
  esito.candidati = daScrivere.length;

  // #REFRESH-1001 — a blocchi, una INSERT multi-riga per blocco. Prima era una
  // INSERT per riga (~1.000 RPC seriali, ~2 minuti): dal 30/09 12:00 il giro
  // finiva sempre a :05:32, cioe' al maxDuration del cron, e tutto cio' che
  // veniva dopo non partiva. Un blocco che fallisce conta come fallito per
  // intero; gli altri restano scritti.
  //
  // `scadenza`: oltre quell'istante non si apre un blocco nuovo. Si saltano le
  // righe rimaste, contate e loggate, invece di morire al timeout della route.
  for (let i = 0; i < daScrivere.length; i += BLOCCO) {
    if (Date.now() >= scadenza) {
      esito.saltati = daScrivere.length - i;
      break;
    }
    const blocco = daScrivere.slice(i, i + BLOCCO);
    // Ogni giro e' una riga NUOVA: la storia serve proprio a vedere il prezzo
    // cambiare. `is_closing` resta false — chi chiude e' un altro processo, e
    // marcarlo qui significherebbe dichiarare finita una partita che non lo e'.
    const params: unknown[] = [];
    const righe = blocco.map((p) => {
      const n = params.length;
      params.push(p.chiave, p.book, p.sport, p.casa, p.ospite,
        p.oddsHome, p.oddsDraw, p.oddsAway, p.inizio, p.minutiAlVia);
      return `(($${n + 1})::text,($${n + 2})::text,($${n + 3})::text,($${n + 4})::text,($${n + 5})::text,` +
        `($${n + 6})::double precision,($${n + 7})::double precision,($${n + 8})::double precision,` +
        `($${n + 9})::timestamptz,($${n + 10})::integer, NOW())`;
    });
    await dbExecute(
      `INSERT INTO partner_price_history
         (team_pair_key, bookmaker, sport, home_name, away_name,
          odds_home, odds_draw, odds_away, commence_time, minuti_al_via, captured_at)
       VALUES ${righe.join(",")}`,
      params,
    ).catch((e: unknown) => {
      esito.falliti += blocco.length;
      console.error("[prezzi-partner] blocco fallito da", blocco[0].chiave, String(e));
    });
  }

  // Il conteggio si ricava da cio' che e' stato tentato meno cio' che e'
  // fallito, e NON da una query sulla tabella.
  //
  // Due ragioni, entrambe imparate oggi a mie spese:
  //  1. `exec_sql` non propaga il RETURNING, quindi contare le righe restituite
  //     dall'INSERT da' sempre zero anche quando scrive (#PARTNER-CONTEGGIO);
  //  2. una count su una tabella grande costa: il primo tentativo scriveva in
  //     `odds_snapshots` (16,2 milioni di righe) e ogni lettura moriva in
  //     statement timeout. Da li' la tabella dedicata — ma l'abitudine di non
  //     interrogare il database per contare cio' che si e' appena scritto resta
  //     giusta comunque.
  esito.scritti = esito.candidati - esito.falliti - esito.saltati;

  console.log(
    `[prezzi-partner] visti ${esito.vistiDalPartner}, candidati ${esito.candidati}, ` +
      `scartati ${esito.scartati}, scritti ${esito.scritti}` +
      (esito.falliti ? `, FALLITI ${esito.falliti}` : "") +
      (esito.saltati ? `, SALTATI ${esito.saltati} (scadenza del cron)` : ""),
  );
  return esito;
}
