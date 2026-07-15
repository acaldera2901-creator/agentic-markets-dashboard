// /api/weekly-pick/callback — #WEEKLY-PICK-1. Mirror ESATTO di
// app/api/paygate/callback. PayGate chiama questo URL (GET, NON firmato) al
// pagamento. Risponde sempre 200 per non innescare retry-storm; il grant avviene
// SOLO se: (1) l'ordine esiste ed è 'pending' (anti-replay), (2) PayGate conferma
// status='paid' server-side via payment-status.php (il callback è spoofabile),
// (3) l'importo verificato regge la soglia, (4) il claim atomico pending→paid
// vince la race. Nessun grant senza pagamento confermato.

import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { hashToken, evaluateCallback, checkPaymentStatus } from "@/lib/paygate";
import { grantWeeklyPick } from "@/lib/weekly-pick-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRow = {
  id: string;
  identifier: string;
  week_start: string;
  amount_usd: number;
  status: string;
  token_hash: string;
  ipn_token: string | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const txidQuery = url.searchParams.get("txid_out");
    if (!token) return NextResponse.json({ ok: true });

    const tokenHash = hashToken(token);
    const orders = await dbQuery<OrderRow>(
      `SELECT id, identifier, week_start::text AS week_start, amount_usd::float8 AS amount_usd,
              status, token_hash, ipn_token
         FROM weekly_pick_orders WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    const order = orders[0] ?? null;
    if (!order || order.status !== "pending") {
      // token sconosciuto o ordine già processato → nessuna azione (anti-spoof + idempotenza)
      return NextResponse.json({ ok: true });
    }
    if (!order.ipn_token) {
      console.error(`[weekly-pick/callback] order=${order.id} senza ipn_token → impossibile verificare, niente grant`);
      return NextResponse.json({ ok: true });
    }

    // VERIFICA SERVER-SIDE: l'esito reale lo dice PayGate, non il callback.
    // Concediamo solo se PayGate dice status='paid'.
    // #PAYGATE-RATELIMIT-FIX (mirror di paygate/callback): payment-status.php può
    // essere rate-limitato per-IP al pagamento → retry dopo pausa salva il grant
    // istantaneo invece di lasciare l'ordine pending senza recupero.
    let verify = await checkPaymentStatus(order.ipn_token);
    if (!verify) {
      await new Promise((r) => setTimeout(r, 2500));
      verify = await checkPaymentStatus(order.ipn_token);
    }
    if (!verify || verify.status !== "paid") {
      console.warn(`[weekly-pick/callback] PayGate status!=paid o verifica fallita (order=${order.id}) → niente grant (resta pending, ritenta)`);
      return NextResponse.json({ ok: true });
    }
    const serverValue = verify.valueCoin;

    // Importo verificato sul VALORE SERVER (non sul value_coin del callback).
    const decision = evaluateCallback({
      order: { status: order.status, amount_usd: order.amount_usd },
      valueCoin: serverValue,
    });
    if (!decision.grant) {
      console.warn(`[weekly-pick/callback] no-grant: ${decision.reason} (order=${order.id}, server value_coin=${String(serverValue)})`);
      return NextResponse.json({ ok: true });
    }

    // CLAIM ATOMICO con valori SERVER: solo il vincitore della race passa
    // pending→paid. La RPC ritorna true SOLO se ha davvero cambiato la riga.
    const db = getSupabaseAdminClient();
    if (!db) { console.error("[weekly-pick/callback] no supabase client"); return NextResponse.json({ ok: true }); }
    const { data: claimed, error: claimErr } = await db.rpc("claim_weekly_pick_order", {
      p_id: order.id, p_value: serverValue, p_txid: verify.txidOut ?? txidQuery,
    });
    if (claimErr) {
      // Non marcato paid → l'ordine resta 'pending' → PayGate può ritentare.
      console.error("[weekly-pick/callback] claim rpc error:", claimErr.message);
      return NextResponse.json({ ok: true });
    }
    if (claimed !== true) {
      // Già processato o non vincitore della race → nessun grant (anti doppio-grant).
      return NextResponse.json({ ok: true });
    }

    // Grant DOPO il claim. grantWeeklyPick è idempotente (UNIQUE identifier+week_start
    // ON CONFLICT DO NOTHING) e lega l'entitlement all'ordine col token_hash.
    await grantWeeklyPick(order.identifier, order.week_start, order.token_hash);
    await dbExecute("UPDATE weekly_pick_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
    console.log(`[weekly-pick/callback] GRANT order=${order.id} week=${order.week_start} value_coin=${String(serverValue)} amount_usd=${String(order.amount_usd)}`);
  } catch (e) {
    console.error("[weekly-pick/callback] error:", String(e));
  }
  return NextResponse.json({ ok: true });
}
