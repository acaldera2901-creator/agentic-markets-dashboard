// lib/weekly-pick-server.ts — #WEEKLY-PICK-1. Data-layer server della weekly pick
// (entitlement + grant). Separato da lib/weekly-pick.ts (puro/testabile) come
// plan-grant.ts lo è da paygate.ts. GATED: usato solo dal wiring dietro flag.

import { dbQuery, dbQueryStrict, dbExecute } from "@/lib/db";

// L'utente ha l'accesso one-off alla weekly pick della settimana `weekStart`?
// (Il Pro è INCLUSO e va gestito a monte via weeklyPickIncludedInPlan — qui si
// verifica solo l'acquisto one-off di Free/Base.)
const HAS_WEEKLY_SQL = `SELECT COUNT(*)::int AS n FROM weekly_pick_purchases
      WHERE (identifier = $1 OR LOWER(TRIM(identifier)) = $1) AND week_start = $2`;

// Lettura TOLLERANTE, per la UI: un errore DB degrada a "non comprata" e la
// pagina resta in piedi.
export async function hasWeeklyPick(identifier: string, weekStart: string): Promise<boolean> {
  const rows = await dbQuery<{ n: number }>(HAS_WEEKLY_SQL, [identifier, weekStart]);
  return (rows[0]?.n ?? 0) > 0;
}

// Lettura FAIL-LOUD, per le guardie D'ACQUISTO. Serve una funzione separata
// perché `dbQuery` ingoia gli errori e ritorna []: usarla in un checkout rende
// un errore DB indistinguibile da "non l'ha comprata" → l'utente paga DUE volte
// la stessa settimana, e il try/catch del chiamante non scatta mai.
export async function hasWeeklyPickStrict(identifier: string, weekStart: string): Promise<boolean> {
  const rows = await dbQueryStrict<{ n: number }>(HAS_WEEKLY_SQL, [identifier, weekStart]);
  return (rows[0]?.n ?? 0) > 0;
}

// Concede l'accesso alla weekly pick della settimana. Idempotente: la UNIQUE
// (identifier, week_start) + ON CONFLICT DO NOTHING rende sicuro un doppio grant
// (retry callback). Non declassa/altro: l'entitlement è per-settimana, additivo.
export async function grantWeeklyPick(
  identifier: string,
  weekStart: string,
  orderTokenHash: string | null
): Promise<void> {
  await dbExecute(
    `INSERT INTO weekly_pick_purchases (identifier, week_start, order_token_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (identifier, week_start) DO NOTHING`,
    [identifier, weekStart, orderTokenHash]
  );
}
