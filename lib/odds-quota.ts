// #ODDS-QUOTA-GUARD — il pezzo mancante di #TENNIS-ODDS-BLACKOUT (PR #174/175).
//
// Il fix precedente mise il cap mensile SOLO sul tracker Python
// (core/quota_tracker.py). Ma il path TS football/estive (lib/odds-api.ts, cron
// /api/predictions/refresh ogni 2h) chiamava The Odds API /odds SENZA passare da
// nessun tracker → bruciava crediti NON contati sull'account condiviso →
// l'account reale è arrivato a 0/100k → 401 OUT_OF_USAGE_CREDITS → fetchOdds
// tornava [] → ogni fixture estiva droppata → board a 0. E, come da commento nel
// tracker, drenava anche il tennis.
//
// Qui portiamo il path TS sotto lo STESSO budget usando il segnale AUTORITATIVO
// dell'account: l'header `x-requests-remaining` di ogni risposta /odds riflette
// GIÀ il consumo combinato (Python + TS + tennis), quindi non c'è rischio di
// doppio conteggio. Se il remaining scende sotto una riserva, il football smette
// di chiamare /odds (degrada a stime-modello, honesty preservata) e lascia i
// crediti agli altri consumer.
import { dbQuery } from "@/lib/db";

// Crediti tenuti da parte per gli altri consumer (tennis OddsPapi/Python, WC,
// goalscorer) fino al reset del ciclo. Sopra soglia il football serve normale;
// sotto, salta /odds. ~una manciata di run football ci stanno dentro.
export const ODDS_RESERVE = 8000;

const PLAN_LIMIT = 100_000;

// Riga TS-owned in source_quota_log. NON tocchiamo provider='odds_api' (di
// proprietà del tracker Python, che fa upsert dell'used cumulativo giornaliero:
// scriverci sopra lo clobbererebbe). Riga separata = ultimo remaining osservato,
// così un cold start serverless può seminare il gate PRIMA della prima chiamata.
const REMAINING_PROVIDER = "odds_api_remaining";

// Stato per-invocazione (i moduli serverless si resettano a freddo): il MINIMO
// remaining osservato in questo run. null = ancora ignoto → fail-open.
let remainingSeen: number | null = null;

/** Solo per i test: azzera lo stato di modulo. */
export function _resetForTest(): void {
  remainingSeen = null;
}

/** Solo per i test: ispeziona il remaining corrente. */
export function _peekRemaining(): number | null {
  return remainingSeen;
}

/**
 * Semina `remainingSeen` dall'ultimo valore persistito. Da chiamare a inizio run
 * (prima del batch /odds) così il gate è attivo già dalla prima lega. Fail-open:
 * se la lettura fallisce o non c'è storico, resta null e non blocchiamo.
 *
 * RECOVERY: ci fidiamo del valore SOLO se recente (< 3h, ~1.5× il cron da 2h).
 * Se stantìo → null → fail-open → il run ri-sonda /odds e ri-osserva il remaining
 * reale. Così dopo una RICARICA crediti (o il reset di ciclo) il football riparte
 * da solo entro un ciclo, invece di restare bloccato su un saldo basso obsoleto.
 * Un valore basso ma fresco blocca (drain reale); uno alto e fresco fa passare.
 */
export async function seedOddsRemaining(): Promise<void> {
  try {
    const rows = await dbQuery<{ requests_made: number; requests_limit: number }>(
      `SELECT requests_made, requests_limit FROM source_quota_log
       WHERE provider = $1 AND last_request_at > NOW() - INTERVAL '3 hours'
       ORDER BY last_request_at DESC LIMIT 1`,
      [REMAINING_PROVIDER]
    );
    if (rows.length) {
      const used = Number(rows[0].requests_made);
      const limit = Number(rows[0].requests_limit) || PLAN_LIMIT;
      if (Number.isFinite(used)) {
        remainingSeen = Math.max(0, limit - used);
      }
    }
  } catch {
    // fail-open: remaining ignoto → non blocchiamo il football
  }
}

/** True se possiamo ancora chiamare /odds (sopra la riserva o remaining ignoto). */
export function oddsBudgetOk(): boolean {
  return remainingSeen === null || remainingSeen > ODDS_RESERVE;
}

/**
 * Aggiorna `remainingSeen` dall'header `x-requests-remaining` di una risposta
 * /odds. Tiene il MINIMO visto (conservativo). Ignora valori nulli/non numerici.
 */
export function observeRemaining(headerValue: string | null): void {
  if (headerValue == null || headerValue === "") return;
  const n = Number(headerValue);
  if (!Number.isFinite(n)) return;
  remainingSeen = remainingSeen === null ? n : Math.min(remainingSeen, n);
}

/**
 * Persiste l'ultimo remaining osservato (fine run) così il prossimo cold start
 * semina il gate. Upsert su (provider, date). Non-fatale su errore.
 */
export async function persistOddsRemaining(): Promise<void> {
  if (remainingSeen === null) return;
  const used = Math.max(0, PLAN_LIMIT - remainingSeen);
  try {
    await dbQuery(
      `INSERT INTO source_quota_log (provider, date, requests_made, requests_limit, last_request_at)
       VALUES ($1, CURRENT_DATE, $2, $3, NOW())
       ON CONFLICT (provider, date) DO UPDATE SET
         requests_made = EXCLUDED.requests_made,
         last_request_at = NOW()`,
      [REMAINING_PROVIDER, used, PLAN_LIMIT]
    );
  } catch {
    // non-fatale: il gate in-memory di questo run ha già fatto il suo lavoro
  }
}
