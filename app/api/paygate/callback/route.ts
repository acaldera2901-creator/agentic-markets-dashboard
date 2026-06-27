import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
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

    // NB: checkPaymentStatus è uno STUB finché Task 7 non lo cabla → tiene PAYGATE_STATUS_CHECK
    // NON impostato fino ad allora, altrimenti questo strato fa fallire OGNI grant.
    // (c) difesa in profondità (attiva solo quando confermato l'endpoint, Task 7)
    if (process.env.PAYGATE_STATUS_CHECK === "1" && order) {
      const st = await checkPaymentStatus({ polygonAddressIn: order.polygon_address_in ?? "", ipnToken: "" });
      if (!st.confirmed) {
        console.warn(`[paygate/callback] status not confirmed (order=${order.id})`);
        return NextResponse.json({ ok: true });
      }
    }

    // Lock idempotente: solo il primo callback "vince" l'UPDATE pending→paid.
    const claimed = await dbExecute<{ id: string }>(
      `UPDATE paygate_orders SET status = 'paid', value_coin = $2, paid_at = NOW()
        WHERE id = $1 AND status = 'pending' RETURNING id`,
      [order!.id, valueCoin]
    );
    if (!claimed?.length) return NextResponse.json({ ok: true }); // già processato

    await activatePaygatePlan(order!.identifier, order!.plan, order!.period);
  } catch (e) {
    console.error("[paygate/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
