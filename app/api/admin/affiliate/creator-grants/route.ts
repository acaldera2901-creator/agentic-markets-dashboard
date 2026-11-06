// /api/admin/affiliate/creator-grants — #CREATOR-OFFERS-1031 (B)
// POST { identifier, note? } → mese Pro di benvenuto (30 giorni) a un creator che
// ha già fatto login dal sito. Una volta per identifier, per sempre: ripetere
// restituisce il grant esistente (`already: true`). Rifiutato (409) per chi ha un
// abbonamento pagato attivo, admin_full o un pagamento in verifica; 404 se il
// profilo non esiste. Auth admin + operatore obbligatorio come le altre azioni.
import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/affiliate/payouts";
import { adminActor } from "@/lib/affiliate/admin-ops";
import { grantCreatorPro } from "@/lib/plan-grant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, true);
  if (denied) return denied;
  const actor = adminActor(req);
  if (!actor) return NextResponse.json({ error: "actor_required" }, { status: 400 });
  let body: { identifier?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  if (!identifier || identifier.length > 254) return NextResponse.json({ error: "invalid_identifier" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  try {
    const res = await grantCreatorPro(identifier, actor, note);
    if (!res.ok) return NextResponse.json(res, { status: res.error === "not_found" ? 404 : 409 });
    console.log(`[admin/affiliate/creator-grants] ok actor=${actor} identifier=${res.identifier} already=${res.already}`);
    return NextResponse.json(res);
  } catch (e) {
    console.error("[admin/affiliate/creator-grants] failed:", String(e));
    return NextResponse.json({ error: "grant failed" }, { status: 503 });
  }
}
