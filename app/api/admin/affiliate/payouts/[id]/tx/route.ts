// /api/admin/affiliate/payouts/[id]/tx — #AFFILIATE-V2-CRYPTO-1007 PR-9 (SPEC-ui §4.2).
// POST { hash } → normalizeTxHash + verifica on-chain PER HASH
// (lib/affiliate/payout-verify.ts). Esiti: paid (≥30 conferme, email
// all'affiliato), submitted (poche conferme → «Riverifica»), rejected{reason}
// (il payout resta in preparazione: un hash sbagliato non si registra mai).
// RPC giù → 503, payout invariato (fail-closed).

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

  let body: { hash?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const payout = await loadPayout(id);
    if (!payout) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return await registerPayoutTx(payout, body.hash);
  } catch (e) {
    console.error(`[admin/affiliate/payouts/tx] failed payout=${id}:`, String(e));
    return NextResponse.json({ error: "record failed" }, { status: 500 });
  }
}
