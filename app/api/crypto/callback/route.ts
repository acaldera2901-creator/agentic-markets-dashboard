import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { hashToken } from "@/lib/paygate";
import { settleCryptoOrder, type CryptoOrder } from "@/lib/crypto-settle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #CRYPTO-DIRECT-1 — PayGate ci avvisa qui quando vede il pagamento (GET, NON
// firmato). Il callback NON è una prova: serve solo da sveglia. La decisione la
// prende settleCryptoOrder guardando la catena, quindi anche se qualcuno
// indovinasse questa URL non otterrebbe nulla senza un pagamento confermato.
// Risponde sempre 200 per non innescare retry-storm.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    if (!token) return NextResponse.json({ ok: true });

    const rows = await dbQuery<CryptoOrder>(
      `SELECT id::text AS id, identifier, plan, period,
              amount_usd::float8 AS amount_usd, status, coin,
              expected_value_coin::float8 AS expected_value_coin,
              crypto_address_in, shopify_order_id
         FROM paygate_orders
        WHERE token_hash = $1 AND coin IS NOT NULL LIMIT 1`,
      [hashToken(token)]
    );
    const order = rows[0];
    if (!order) return NextResponse.json({ ok: true });

    const r = await settleCryptoOrder(order);
    console.log(`[crypto/callback] order=${order.id} granted=${r.granted} reason=${r.reason}`);
  } catch (e) {
    console.error("[crypto/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
