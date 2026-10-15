// /api/admin/affiliate/payouts/[id]/verify — #AFFILIATE-V2-CRYPTO-1007 PR-9.
// POST → «Riverifica»: rilegge on-chain l'hash GIÀ registrato di un payout
// `submitted` (poche conferme al primo giro) e lo porta a `paid` se ora basta.

import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, loadPayout, parsePayoutId, payoutsOff, registerPayoutTx } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req, true);
  if (denied) return denied;
  const off = payoutsOff();
  if (off) return off;
  const id = parsePayoutId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const payout = await loadPayout(id);
    if (!payout) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (payout.status !== "submitted" || !payout.tx_hash) {
      return NextResponse.json({ error: "not_submitted", status: payout.status }, { status: 409 });
    }
    return await registerPayoutTx(payout, payout.tx_hash);
  } catch (e) {
    console.error(`[admin/affiliate/payouts/verify] failed payout=${id}:`, String(e));
    return NextResponse.json({ error: "verify failed" }, { status: 500 });
  }
}
