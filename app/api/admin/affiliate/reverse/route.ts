// /api/admin/affiliate/reverse — #AFFILIATE-REVERSAL-1022 (PROPOSAL-tecnica §4.2).
//
// POST { rail, payment_ref, event_ref, refunded_usd? } → storna la commissione
// di un pagamento rimborsato A MANO: PayGate e crypto non hanno un webhook di
// rimborso (il rimborso è un invio manuale), quindi chi rimborsa registra qui lo
// storno. refunded_usd assente/null = storno totale. Serve anche a rigiocare uno
// storno di webhook fallito (l'alert «affiliate-reversal» riporta rail,
// payment_ref, event_ref e importo). Stessa logica e stessa idempotenza dei
// webhook (lib/affiliate/reversal.ts): ripetere la stessa event_ref non scrive
// due volte. Per un rimborso manuale usare un id proprio e univoco (es.
// «manual-2026-10-22-<ordine>»). Auth admin + blocco cross-site come payouts.
// #AFFILIATE-REVERSE-AUDIT-1022: operatore obbligatorio (come le altre azioni
// admin: `x-admin-actor` dal BO, «admin-cookie» da /admin); lo storno scritto
// finisce in affiliate_admin_actions nella stessa transazione.

import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/affiliate/payouts";
import { adminActor } from "@/lib/affiliate/admin-ops";
import { reverseAffiliateCommissionSafe } from "@/lib/affiliate/reversal";
import type { AffiliateRail } from "@/lib/affiliate/net";

export const dynamic = "force-dynamic";

const RAILS: ReadonlySet<AffiliateRail> = new Set(["paygate", "crypto", "paypal", "shopify", "stripe"]);
const REF = /^[A-Za-z0-9:_.\-]{1,120}$/;

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, true);
  if (denied) return denied;
  const actor = adminActor(req);
  if (!actor) return NextResponse.json({ error: "actor_required" }, { status: 400 });
  let body: { rail?: unknown; payment_ref?: unknown; event_ref?: unknown; refunded_usd?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const rail = String(body.rail ?? "") as AffiliateRail;
  const paymentRef = String(body.payment_ref ?? "").trim();
  const eventRef = String(body.event_ref ?? "").trim();
  const refunded = body.refunded_usd == null ? null : Number(body.refunded_usd);
  if (!RAILS.has(rail)) return NextResponse.json({ error: "invalid rail" }, { status: 400 });
  if (!REF.test(paymentRef) || !REF.test(eventRef)) return NextResponse.json({ error: "invalid ref" }, { status: 400 });
  if (refunded != null && !(Number.isFinite(refunded) && refunded > 0)) {
    return NextResponse.json({ error: "invalid refunded_usd" }, { status: 400 });
  }
  const outcome = await reverseAffiliateCommissionSafe({
    rail,
    paymentRef,
    // La event_ref NON si prefissa: rigiocare dall'alert lo storno di un webhook
    // con la sua stessa event_ref deve dare `duplicate` se era già passato.
    eventRef,
    refundedGrossUsd: refunded,
    actor,
  });
  return NextResponse.json(outcome, { status: outcome.reason === "error" ? 503 : 200 });
}
