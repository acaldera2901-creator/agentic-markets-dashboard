// /api/admin/affiliate/offers — #CREATOR-OFFERS-1031
//
// GET  ?affiliate_id=N[&period=YYYY-MM] → canale di pagamento, tutte le offerte
//      (storia inclusa), quella in vigore ora e il dovuto del mese
//      (dovutoManuale, default mese corrente UTC).
// POST { affiliate_id, reason, offer: {...}, payout_channel?: "crypto"|"manual" }
//      → affiliate_admin_set_offer: chiude l'offerta aperta, apre la nuova,
//      riga `offer_set` in affiliate_admin_actions, nella stessa transazione.
// Auth admin + operatore come le altre rotte app/api/admin/affiliate/*.

import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId, reasonOf } from "@/lib/affiliate/admin-ops";
import { dovutoManuale, parsePeriod } from "@/lib/affiliate/manual-due";
import { offerFor, offersOf, parseOfferInput } from "@/lib/affiliate/offers";
import { adminGuard, currentMonth } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req, false);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const id = positiveId(q.get("affiliate_id") ?? "");
  if (!id) return NextResponse.json({ error: "invalid affiliate_id" }, { status: 400 });
  const period = parsePeriod(q.get("period") ?? currentMonth());
  if (!period) return NextResponse.json({ error: "invalid period" }, { status: 400 });
  try {
    const due = await dovutoManuale(id, period);
    if (!due) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const [offers, current] = await Promise.all([offersOf(id), offerFor(id, new Date())]);
    return NextResponse.json({ affiliate_id: id, payout_channel: due.payout_channel, current, offers, due });
  } catch (e) {
    console.error("[admin/affiliate/offers] GET failed:", String(e));
    return NextResponse.json({ error: "offers read failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return adminOp(req, "offers", async (b, actor) => {
    const id = positiveId(String(b.affiliate_id ?? ""));
    if (!id) return NextResponse.json({ error: "invalid affiliate_id" }, { status: 400 });
    const reason = reasonOf(b.reason);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    const channel = b.payout_channel ?? null;
    if (channel !== null && channel !== "crypto" && channel !== "manual") {
      return NextResponse.json({ error: "invalid_payout_channel" }, { status: 400 });
    }
    const parsed = parseOfferInput(b.offer);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    return {
      fn: "affiliate_admin_set_offer",
      args: { p_actor: actor, p_affiliate_id: id, p_offer: parsed.offer, p_payout_channel: channel, p_reason: reason },
    };
  });
}
