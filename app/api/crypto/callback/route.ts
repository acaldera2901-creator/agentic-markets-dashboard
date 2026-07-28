import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { hashToken } from "@/lib/paygate";
import {
  settleCryptoOrder,
  settleWeeklyCryptoOrder,
  type CryptoOrder,
  type WeeklyCryptoOrder,
} from "@/lib/crypto-settle";

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

    // #WEEKLY-CRYPTO-DIRECT-1 — `kind` è nella callback URL che abbiamo costruito
    // noi al checkout e dice in quale tabella cercare. Non è una credenziale: il
    // lookup è per token_hash, quindi un kind sbagliato non trova la riga e non
    // concede niente.
    const isWeekly = url.searchParams.get("kind") === "weekly";
    const tokenHash = hashToken(token);

    const weeklyRows = isWeekly
      ? await dbQuery<WeeklyCryptoOrder>(
          `SELECT id::text AS id, identifier, week_start::text AS week_start,
                  amount_usd::float8 AS amount_usd, status, coin, token_hash,
                  expected_value_coin::float8 AS expected_value_coin,
                  crypto_address_in, shopify_order_id
             FROM weekly_pick_orders
            WHERE token_hash = $1 AND coin IS NOT NULL LIMIT 1`,
          [tokenHash]
        )
      : [];
    const planRows = isWeekly
      ? []
      : await dbQuery<CryptoOrder>(
          `SELECT id::text AS id, identifier, plan, period,
                  amount_usd::float8 AS amount_usd, status, coin,
                  expected_value_coin::float8 AS expected_value_coin,
                  crypto_address_in, shopify_order_id
             FROM paygate_orders
            WHERE token_hash = $1 AND coin IS NOT NULL LIMIT 1`,
          [tokenHash]
        );

    const order = weeklyRows[0] ?? planRows[0];
    if (!order) return NextResponse.json({ ok: true });

    const r = weeklyRows[0]
      ? await settleWeeklyCryptoOrder(weeklyRows[0])
      : await settleCryptoOrder(planRows[0]);
    console.log(`[crypto/callback] order=${order.id} kind=${isWeekly ? "weekly" : "plan"} granted=${r.granted} reason=${r.reason}`);
  } catch (e) {
    console.error("[crypto/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
