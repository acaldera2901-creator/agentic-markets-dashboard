import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { settlePendingOrder, classifyMyOrders, type MineOrder } from "@/lib/paygate-settle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #PAYGATE-INSTANT-GRANT — settle on-demand del PROPRIO ordine.
// Il percorso di grant PRIMARIO al ritorno dal checkout: la pagina /app (poll
// #PAYGATE-RETURN-SMOOTH) chiama questo endpoint mentre l'utente aspetta, così il
// piano viene concesso in pochi secondi dalla conferma on-chain SENZA dipendere dal
// callback IPN (che può non partire) né dal reconcile-cron (fino a 5 min). Il
// callback e il reconcile restano come livelli indipendenti: nessun singolo punto
// di fallimento. Session-autenticato: agisce SOLO sull'ordine dell'utente loggato,
// riusa ESATTAMENTE la sequenza verificata+claim-atomico+grant di settlePendingOrder
// (nessuna nuova fonte di verità, nessun doppio-grant possibile).
export async function POST(req: Request) {
  // Route mutante autorizzata via cookie di sessione: blocca i trigger cross-site.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[paygate/settle-mine] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Solo gli ordini dell'utente, finestra 48h (oltre = abbandonato → lo prende il cron).
  const orders = await dbQuery<MineOrder>(
    `SELECT id::text AS id, identifier, plan, period, amount_usd::float8 AS amount_usd,
            status, ipn_token, granted_at::text AS granted_at, created_at::text AS created_at
       FROM paygate_orders
      WHERE (identifier = $1 OR LOWER(TRIM(identifier)) = $1)
        AND created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at DESC
      LIMIT 10`,
    [ctx.identifier]
  );

  const { action, order } = classifyMyOrders(orders);
  let settled = false;
  try {
    if (action === "settle_pending" && order) {
      // UNICO path di grant on-demand: passa dal claim atomico (claim_paygate_order)
      // dentro settlePendingOrder → doppio-grant impossibile anche con più tab/poll.
      const r = await settlePendingOrder(order);
      settled = r.granted;
    }
    // action === "grant_paid" (paid ma granted_at NULL) NON viene concesso qui: senza
    // un lock atomico, due poll concorrenti estenderebbero il piano due volte. È un
    // caso raro (transiente) e lo salda in sicurezza il reconcile-cron (ogni 5 min,
    // single-thread, guardato da granted_at IS NULL). Lo riportiamo come 'pending'.
  } catch (e) {
    console.error(`[paygate/settle-mine] settle failed (identifier=${ctx.identifier}, action=${action}):`, String(e));
  }

  // Rileggo il piano fresco (effectivePlan-adjusted) per la UI.
  let fresh;
  try {
    fresh = await getSessionPlan(req);
  } catch {
    fresh = ctx;
  }

  // status: granted = piano già/ora attivo · pending = pagato-non-ancora-confermato,
  // riprova · none = nessun ordine azionabile.
  const alreadyGranted = action === "granted";
  const status = alreadyGranted || settled ? "granted" : action === "none" ? "none" : "pending";
  return NextResponse.json({
    status,
    plan: fresh?.plan ?? ctx.plan,
    plan_expires_at: fresh?.plan_expires_at ?? ctx.plan_expires_at,
  });
}
