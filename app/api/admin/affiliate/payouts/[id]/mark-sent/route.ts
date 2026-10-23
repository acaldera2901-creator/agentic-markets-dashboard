// /api/admin/affiliate/payouts/[id]/mark-sent — #AFFILIATE-OPS-1022 (R-C)
// POST {} → affiliate_payout_mark_sent. Da chiamare PRIMA di inviare i fondi:
// da qui il payout non si annulla più (né admin, né cambio wallet, né
// sospensione) e accetta il tx hash anche se l'affiliato viene sospeso.
// Idempotente. Spento con AFFILIATE_PAYOUTS=off. Nessun fondo parte da qui:
// l'invio è manuale, dal wallet di uscita, fuori dal codice.
import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId } from "@/lib/affiliate/admin-ops";
import { payoutsOff } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = positiveId((await ctx.params).id);
  return adminOp(req, "mark-sent", async (_b, actor) => {
    const off = payoutsOff();
    if (off) return off;
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    return { fn: "affiliate_payout_mark_sent", args: { p_id: id, p_by: actor } };
  });
}
