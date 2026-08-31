// #LEDGER-MIRROR-0831 — la chiave e il payload della riga di CHIUSURA del
// registro sigillato, in un posto solo.
//
// PERCHE' ESISTE. `pick_settlement` e' il registro append-only che rende onesto
// il track record: una riga per pick, scritta quando l'evento si risolve,
// agganciata alla riga sigillata di `pick_ledger` dalla FK
// (source_table, source_id, model_version).
//
// La misura del 31/08 su produzione ha trovato 88 pick SIGILLATE senza riga di
// chiusura, con la partita iniziata da piu' di sei ore, distribuite dal 27/06 al
// 29/08 — cioe' una perdita CONTINUA su due mesi, sulla tabella che Telegram
// pubblica come prova pubblica. Le cause erano due, con la stessa forma:
//
//   60 righe 'unresolved' — lo step E di app/api/cron/settle (il watchdog di
//      stallo) chiudeva la riga servita dopo 48h e NON scriveva il mirror;
//   17 righe 'void'      — il ramo void-abbandonata di
//      agents/result_settlement.py::_unified_settlement_cycle, stesso buco;
//    8 righe 'won'/'lost' del 27/06-11/07, precedenti all'introduzione del
//      mirror: residuo storico, non un difetto attivo.
//
// PERCHE' NON SI VEDEVA. La FK rifiuta l'insert con `23503` quando non esiste la
// riga sigillata corrispondente, e quel codice e' legittimamente atteso (si
// chiudono solo i pick che abbiamo registrato). Ma scartarlo SENZA CONTARLO
// rende indistinguibile «atteso» da «chiave sbagliata»: il difetto si
// nasconde da solo. Per questo `isLedgerFkRejection` esiste come funzione e i
// chiamanti contano gli scarti nel report.
//
// PERCHE' LA CHIAVE STA QUI. Era scritta a mano in tre posti (questo cron,
// l'agente Python, l'adapter che sigilla). Tre copie di una chiave divergono, e
// una divergenza si presenterebbe proprio come un 23503 «atteso». Qui c'e' una
// copia sola, e pick-ledger-mirror.test.ts la confronta MECCANICAMENTE con il
// letterale del lato Python.

/** Tabella sorgente dei pick calcio nel registro. */
export const FOOTBALL_LEDGER_SOURCE_TABLE = "match_predictions";

/** Versione modello con cui il calcio viene sigillato e chiuso. */
export const FOOTBALL_LEDGER_MODEL_VERSION = "football-v4-xg-model";

/**
 * Bersaglio di conflitto dell'upsert. Deve coincidere con l'indice UNIQUE
 * `pick_settlement_pick_key (source_table, source_id, model_version)`, che e'
 * anche la colonna-chiave della FK verso `pick_ledger`.
 */
export const LEDGER_MIRROR_CONFLICT = "source_table,source_id,model_version";

/**
 * Esiti con cui una riga puo' lasciare la board. `unresolved` NON e' `void`:
 * una partita che non abbiamo mai scorato non finge un rimborso nel track
 * record (/api/v2/history esclude 'unresolved'), ma la sua riga nel registro
 * deve esistere comunque — altrimenti il pick sigillato resta senza chiusura e
 * il registro mente per omissione.
 */
export type LedgerResult = "won" | "lost" | "void" | "unresolved";

export interface LedgerMirrorRow {
  source_table: string;
  source_id: string;
  model_version: string;
  result: LedgerResult;
  outcome: string | null;
  final_score: string | null;
  closing_odds: null;
}

/**
 * La riga di chiusura da scrivere per un pick calcio.
 *
 * `closing_odds` e' `null` PER TIPO e non per scelta del chiamante: al 31/08 non
 * esiste una quota di chiusura agganciabile ai nostri pick. Misurato: le righe
 * `is_closing` degli ultimi 30 giorni sono 1.410, ma 1.169 vengono da
 * stake/roobet — la via che per regola di sistema alimenta solo la misura e mai
 * il prodotto — e le 241 di `odds_api` coprono OTTO partite, nessuna delle quali
 * compare in `pick_ledger`. Finche' quella copertura non esiste, un CLV scritto
 * qui sarebbe inventato. Il tipo lo rende impossibile invece di lasciarlo alla
 * disciplina di chi chiama.
 */
export function ledgerMirrorRow(args: {
  sourceId: string;
  result: LedgerResult;
  /** HOME/DRAW/AWAY realizzato. `null` quando non c'e' un punteggio. */
  outcome?: string | null;
  /** "2-1". `null` quando non c'e' un punteggio. */
  finalScore?: string | null;
}): LedgerMirrorRow {
  return {
    source_table: FOOTBALL_LEDGER_SOURCE_TABLE,
    source_id: args.sourceId,
    model_version: FOOTBALL_LEDGER_MODEL_VERSION,
    result: args.result,
    outcome: args.outcome ?? null,
    final_score: args.finalScore ?? null,
    closing_odds: null,
  };
}

/**
 * `true` per il rifiuto della FK verso `pick_ledger`: nessuna riga sigillata
 * corrisponde a questa chiave. E' l'unico errore che un chiamante puo'
 * assorbire — e va CONTATO, non ignorato (vedi la nota in testa al file).
 */
export function isLedgerFkRejection(code: string | null | undefined): boolean {
  return code === "23503";
}

/**
 * Il conteggio che avrebbe fatto vedere la perdita: pick sigillati la cui
 * partita e' iniziata da piu' di `graceHours` ore e che non hanno riga di
 * chiusura. Il join e' sulle TRE colonne della FK, non su due: due colonne
 * darebbero lo stesso numero solo finche' `model_version` e' uniforme, e il
 * giorno che non lo e' il conteggio mentirebbe verso il basso.
 */
export function sealedOrphansSql(graceHours = 6): string {
  return `SELECT count(*)::int AS n
            FROM pick_ledger l
            LEFT JOIN pick_settlement s
                   ON s.source_table  = l.source_table
                  AND s.source_id     = l.source_id
                  AND s.model_version = l.model_version
           WHERE s.id IS NULL
             AND l.commence_time < NOW() - INTERVAL '${graceHours} hours'`;
}
