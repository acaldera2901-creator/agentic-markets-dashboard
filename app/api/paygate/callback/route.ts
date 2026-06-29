import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { hashToken, evaluateCallback } from "@/lib/paygate";
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
  polygon_address_in: string | null;
};

// PayGate chiama questo URL (GET, NON firmato) al pagamento. Risponde sempre 200
// per non innescare retry-storm; il grant avviene solo se la verifica passa.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const rawValue = url.searchParams.get("value_coin");
    const valueCoin = rawValue != null && rawValue !== "" ? Number(rawValue) : null;
    const txidOut = url.searchParams.get("txid_out");
    if (!token) return NextResponse.json({ ok: true });

    const tokenHash = hashToken(token);
    const orders = await dbQuery<OrderRow>(
      `SELECT id, identifier, plan, period, amount_usd::float8 AS amount_usd, status, polygon_address_in
         FROM paygate_orders WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    const order = orders[0] ?? null;

    // (a) token + (b) importo
    const decision = evaluateCallback({
      order: order ? { status: order.status, amount_usd: order.amount_usd } : null,
      valueCoin,
    });
    if (!decision.grant) {
      console.warn(`[paygate/callback] no-grant: ${decision.reason} (token_hash=${tokenHash.slice(0, 12)})`);
      return NextResponse.json({ ok: true });
    }

    // #3 — CLAIM ATOMICO: solo il vincitore della race passa pending→paid.
    // La RPC ritorna true SOLO se ha davvero cambiato la riga (no row-count via exec_sql).
    const db = getSupabaseAdminClient();
    if (!db) { console.error("[paygate/callback] no supabase client"); return NextResponse.json({ ok: true }); }
    const { data: claimed, error: claimErr } = await db.rpc("claim_paygate_order", {
      p_id: order!.id, p_value: valueCoin, p_txid: txidOut,
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
    const granted = await activatePaygatePlan(order!.identifier, order!.plan, order!.period);
    if (!granted) {
      console.error(`[paygate/callback] RECONCILE: paid ma piano NON concesso (identifier-not-found) order=${order!.id} identifier=${order!.identifier}`);
    } else {
      await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [order!.id]);
      console.log(`[paygate/callback] GRANT order=${order!.id} plan=${granted.plan} value_coin=${String(valueCoin)} amount_usd=${String(order!.amount_usd)}`);
    }
  } catch (e) {
    console.error("[paygate/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
