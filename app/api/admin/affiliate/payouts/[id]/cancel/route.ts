// /api/admin/affiliate/payouts/[id]/cancel — #AFFILIATE-V2-CRYPTO-1007 PR-9.
// POST { reason } → annulla SOLO un payout `created` (senza hash): motivo libero
// obbligatorio (resta all'admin), le commissioni tornano maturate, email
// generica all'affiliato (cancel_code = admin_cancelled, mai il motivo).
// Ammesso anche con AFFILIATE_PAYOUTS=off: annullare riduce il rischio, non lo
// aumenta.

import { NextResponse, type NextRequest } from "next/server";
import { payoutCancelledEmail } from "@/lib/affiliate/emails";
import { adminGuard, loadPayout, mailLangOf, notifyAffiliate, parsePayoutId } from "@/lib/affiliate/payouts";
import { affiliateRpc } from "@/lib/affiliate/rpc";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req, true);
  if (denied) return denied;
  const id = parsePayoutId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  try {
    const payout = await loadPayout(id);
    if (!payout) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const res = await affiliateRpc("affiliate_cancel_payout", { p_id: id, p_reason: reason });
    if (!res.ok) return NextResponse.json(res, { status: 409 });
    await notifyAffiliate(
      payout.affiliate_identifier,
      payoutCancelledEmail({ lang: await mailLangOf(payout.affiliate_identifier), amountUsd: payout.amount_usd }),
    );
    console.log(`[admin/affiliate/payouts/cancel] cancelled payout=${id}`);
    return NextResponse.json({ ok: true, payout_id: id });
  } catch (e) {
    console.error(`[admin/affiliate/payouts/cancel] failed payout=${id}:`, String(e));
    return NextResponse.json({ error: "cancel failed" }, { status: 500 });
  }
}
