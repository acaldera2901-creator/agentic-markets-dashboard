import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { hashToken, evaluateCallback, checkPaymentStatus } from "@/lib/paygate";
import { activatePaygatePlan } from "@/lib/plan-grant";
import { receiptEmail } from "@/lib/email";
import { sendTransactional } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRow = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amount_usd: number;
  status: string;
  ipn_token: string | null;
};

// PayGate chiama questo URL (GET, NON firmato) al pagamento. Risponde sempre 200
// per non innescare retry-storm; il grant avviene solo se la verifica passa.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const txidQuery = url.searchParams.get("txid_out");
    const orderQuery = url.searchParams.get("order");

    // #PAYGATE-INSTANT-GRANT diag: PROVA di consegna del callback IPN. I log-funzione
    // dei serverless non sono leggibili (403 per il ruolo corrente), quindi
    // persistiamo ogni hit in events per capire via SQL SE e QUANDO PayGate ci chiama
    // davvero (sospetto storico: il callback non concede mai, tutti i grant vengono
    // dal reconcile). Best-effort: non deve MAI alterare il flusso del callback.
    try {
      await dbExecute(
        `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
         VALUES ('paygate_callback_hit', $1, NULL, NULL, NULL, NULL, 0, $2)`,
        [orderQuery, JSON.stringify({ hasToken: !!token, txidQuery })]
      );
    } catch { /* diag best-effort */ }

    if (!token) return NextResponse.json({ ok: true });

    const tokenHash = hashToken(token);
    const orders = await dbQuery<OrderRow>(
      `SELECT id, identifier, plan, period, amount_usd::float8 AS amount_usd, status, ipn_token
         FROM paygate_orders WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    const order = orders[0] ?? null;
    if (!order || order.status !== "pending") {
      // token sconosciuto o ordine già processato → nessuna azione (anti-spoof + idempotenza)
      return NextResponse.json({ ok: true });
    }
    if (!order.ipn_token) {
      console.error(`[paygate/callback] order=${order.id} senza ipn_token → impossibile verificare, niente grant`);
      return NextResponse.json({ ok: true });
    }

    // #1 — VERIFICA SERVER-SIDE: l'esito reale lo dice PayGate, non il callback
    // (non firmato/spoofabile). Concediamo solo se PayGate dice status='paid'.
    // #PAYGATE-RATELIMIT-FIX: al pagamento payment-status.php può essere
    // rate-limitato (stesso burst del checkout) → retry dopo pausa salva il
    // grant istantaneo; se fallisce ancora, la reconcile chiude ≤15 min.
    let verify = await checkPaymentStatus(order.ipn_token);
    if (!verify) {
      await new Promise((r) => setTimeout(r, 2500));
      verify = await checkPaymentStatus(order.ipn_token);
    }
    if (!verify || verify.status !== "paid") {
      console.warn(`[paygate/callback] PayGate status!=paid o verifica fallita (order=${order.id}) → niente grant (resta pending, ritenta)`);
      return NextResponse.json({ ok: true });
    }
    const serverValue = verify.valueCoin;

    // (b) importo verificato sul VALORE SERVER (non sul value_coin del callback)
    const decision = evaluateCallback({
      order: { status: order.status, amount_usd: order.amount_usd },
      valueCoin: serverValue,
    });
    if (!decision.grant) {
      console.warn(`[paygate/callback] no-grant: ${decision.reason} (order=${order.id}, server value_coin=${String(serverValue)})`);
      return NextResponse.json({ ok: true });
    }

    // #3 — CLAIM ATOMICO con valori SERVER: solo il vincitore della race passa pending→paid.
    // La RPC ritorna true SOLO se ha davvero cambiato la riga (no row-count via exec_sql).
    const db = getSupabaseAdminClient();
    if (!db) { console.error("[paygate/callback] no supabase client"); return NextResponse.json({ ok: true }); }
    const { data: claimed, error: claimErr } = await db.rpc("claim_paygate_order", {
      p_id: order.id, p_value: serverValue, p_txid: verify.txidOut ?? txidQuery,
    });
    if (claimErr) {
      // Non marcato paid → l'ordine resta 'pending' → PayGate può ritentare.
      console.error("[paygate/callback] claim rpc error:", claimErr.message);
      return NextResponse.json({ ok: true });
    }
    if (claimed !== true) {
      // Già processato o non vincitore della race → nessun grant (anti doppio-grant).
      return NextResponse.json({ ok: true });
    }

    // #2 — grant DOPO il claim; identifier-not-found e fallimenti → riconciliazione
    // (granted_at resta NULL + log loud), NON più 200 silenzioso.
    const granted = await activatePaygatePlan(order.identifier, order.plan, order.period);
    if (!granted) {
      console.error(`[paygate/callback] RECONCILE: paid ma piano NON concesso (identifier-not-found) order=${order.id}`);
    } else {
      await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
      console.log(`[paygate/callback] GRANT order=${order.id} plan=${granted.plan} value_coin=${String(serverValue)} amount_usd=${String(order.amount_usd)}`);

      // #GOLIVE-HIGH-E ricevuta: stesso pattern del webhook Stripe (invoice.paid),
      // ma con l'importo reale dell'ordine PayGate (amount_usd → minor units).
      // A differenza di planActivatedEmail (solo su transizione) la ricevuta parte
      // su OGNI pagamento riuscito, rinnovi inclusi. Fire-and-forget: un errore
      // email non deve mai bloccare il callback (l'ordine è già granted+claimed).
      if (order.identifier.includes("@")) {
        try {
          const exp = await dbQuery<{ plan_expires_at: string | null }>(
            "SELECT plan_expires_at::text FROM profiles WHERE identifier = $1 LIMIT 1",
            [order.identifier]
          );
          const mail = receiptEmail(
            Math.round(order.amount_usd * 100),
            "USD",
            order.plan,
            exp[0]?.plan_expires_at ?? null
          );
          await sendTransactional({
            type: "receipt",
            to: order.identifier,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            meta: { order: order.id, plan: order.plan, rail: "paygate" },
          });
        } catch (e) {
          console.error(`[paygate/callback] receipt email failed (order=${order.id}):`, String(e));
        }
      }
    }
  } catch (e) {
    console.error("[paygate/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
