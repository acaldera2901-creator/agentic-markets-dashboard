// lib/weekly-pick-server.ts — #WEEKLY-PICK-1. Data-layer server della weekly pick
// (entitlement + grant). Separato da lib/weekly-pick.ts (puro/testabile) come
// plan-grant.ts lo è da paygate.ts. GATED: usato solo dal wiring dietro flag.

import { dbQuery, dbQueryStrict, dbExecute } from "@/lib/db";
import { weeklyPickReceiptEmail } from "@/lib/email";
import { sendTransactional } from "@/lib/notify";

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

// #CRYPTO-RECEIPTS-1 — effetto collaterale di NOTIFICA dell'acquisto weekly: riga di
// audit in `events` + ricevuta al cliente. Separata dal grant (che deve restare la
// scrittura pura dell'entitlement) e modellata su notifyPlanActivated in
// lib/plan-grant.ts: prima di questo, una Weekly Pick pagata non produceva né email
// né traccia interna — solo la riga d'ordine.
//
// Fire-and-forget su tutto: quando viene chiamata i soldi sono arrivati e la pick è
// già concessa, quindi né un errore email né uno di scrittura devono risalire e far
// sembrare fallito un pagamento riuscito.
// L'invio-una-volta-sola lo garantisce il chiamante: ci si arriva solo dopo aver vinto
// il claim atomico, oppure sulla transizione granted_at NULL→NOW nel cron.
export async function notifyWeeklyPickGranted(opts: {
  identifier: string;
  weekStart: string;
  amountUsd: number;
  rail: string;
  orderId: string;
}): Promise<void> {
  try {
    await dbExecute(
      `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
       VALUES ('weekly_pick_purchased', $1, NULL, NULL, NULL, NULL, $2, $3)`,
      [opts.orderId, opts.amountUsd, JSON.stringify({ identifier: opts.identifier, week_start: opts.weekStart, rail: opts.rail })]
    );
  } catch (e) {
    console.error(`[weekly-pick] audit event failed (order=${opts.orderId}):`, String(e));
  }

  if (!opts.identifier.includes("@")) return;
  try {
    // Lingua = quella con cui il cliente si è iscritto.
    const rows = await dbQuery<{ language: string | null }>(
      "SELECT language FROM profiles WHERE identifier = $1 LIMIT 1",
      [opts.identifier]
    );
    const mail = weeklyPickReceiptEmail(
      Math.round(opts.amountUsd * 100),
      "USD",
      opts.weekStart,
      rows[0]?.language ?? undefined
    );
    await sendTransactional({
      type: "receipt",
      to: opts.identifier,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      meta: { order: opts.orderId, product: "weekly_pick", week_start: opts.weekStart, rail: opts.rail },
    });
  } catch (e) {
    console.error(`[weekly-pick] receipt email failed (order=${opts.orderId}):`, String(e));
  }
}
