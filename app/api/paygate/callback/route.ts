import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { hashToken, evaluateCallback, checkPaymentStatus } from "@/lib/paygate";
import { activatePaygatePlan } from "@/lib/plan-grant";

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
    const verify = await checkPaymentStatus(order.ipn_token);
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
    }
  } catch (e) {
    console.error("[paygate/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
