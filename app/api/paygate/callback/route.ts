import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
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

    // Marca pending→paid. NB: exec_sql non restituisce RETURNING (né il row-count),
    // quindi l'anti-doppio-grant si appoggia al controllo status='pending' fatto da
    // evaluateCallback sopra (un secondo callback rilegge status='paid' → no-grant)
    // più il guard WHERE status='pending' qui.
    await dbExecute(
      `UPDATE paygate_orders SET status = 'paid', value_coin = $2, txid_out = $3, paid_at = NOW()
        WHERE id = $1 AND status = 'pending'`,
      [order!.id, valueCoin, txidOut]
    );

    console.log(`[paygate/callback] GRANT order=${order!.id} plan=${order!.plan} period=${order!.period} value_coin=${String(valueCoin)} amount_usd=${String(order!.amount_usd)}`);
    await activatePaygatePlan(order!.identifier, order!.plan, order!.period);
  } catch (e) {
    console.error("[paygate/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
