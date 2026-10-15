// /api/admin/affiliate/payouts — #AFFILIATE-V2-CRYPTO-1007 PR-9 (SPEC-ui §4.1, §12).
//
// GET  ?month=YYYY-MM (default: mese corrente UTC) → tutti gli affiliati con
//      saldo, wallet (intero: l'admin lo copia), «utilizzabile dal», controlli,
//      pagato nell'anno, payout del mese e MOTIVI di esclusione. Nessuna riga
//      sparisce. In testa: wallet di uscita pubblico (D2) e totale da caricarci.
// POST { month, ids[], expected_total } → crea i payout `created` del mese in
//      UNA transazione (affiliate_create_payouts): lock, regole rilette dopo i
//      lock, tutto o niente; se il totale ricalcolato ≠ expected_total non crea
//      e restituisce il diff.
// Auth admin + blocco cross-site come app/api/admin/activations. Scritture solo
// con AFFILIATE_PAYOUTS=live (default off) e un wallet di uscita configurato.

import { NextResponse, type NextRequest } from "next/server";
import { affiliatePayoutsMode, payoutConfig } from "@/lib/affiliate/config";
import {
  adminGuard,
  currentMonth,
  eligibilityParams,
  loadMonthRows,
  monthSummary,
  parseExpectedTotal,
  parseIds,
  parseMonth,
  payoutsOff,
} from "@/lib/affiliate/payouts";
import { affiliateRpc } from "@/lib/affiliate/rpc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req, false);
  if (denied) return denied;
  const m = parseMonth(new URL(req.url).searchParams.get("month") ?? currentMonth());
  if (!m) return NextResponse.json({ error: "invalid month" }, { status: 400 });
  try {
    const rows = await loadMonthRows(m.period);
    const p = eligibilityParams();
    return NextResponse.json({
      month: m.month,
      current_month: currentMonth(),
      mode: affiliatePayoutsMode(),
      payout_from: payoutConfig().payoutFrom,
      min_payout_usd: p.min,
      rails: { coins: p.coins, networks: p.networks },
      summary: monthSummary(rows),
      rows,
    });
  } catch (e) {
    console.error("[admin/affiliate/payouts] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard(req, true);
  if (denied) return denied;
  const off = payoutsOff();
  if (off) return off;
  if (!payoutConfig().payoutFrom) {
    // D2: senza un wallet di uscita dedicato non si prepara niente da inviare.
    return NextResponse.json({ error: "payout_from_not_configured" }, { status: 503 });
  }

  let body: { month?: unknown; ids?: unknown; expected_total?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const m = parseMonth(typeof body.month === "string" ? body.month : null);
  if (!m) return NextResponse.json({ error: "invalid month" }, { status: 400 });
  if (m.month !== currentMonth()) return NextResponse.json({ error: "period_not_current" }, { status: 409 });
  const ids = parseIds(body.ids);
  if (!ids) return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  const expected = parseExpectedTotal(body.expected_total);
  if (!expected) return NextResponse.json({ error: "invalid expected_total" }, { status: 400 });

  const p = eligibilityParams();
  let res;
  try {
    res = await affiliateRpc("affiliate_create_payouts", {
      p_ids: ids,
      p_period: m.period,
      p_expected_total: expected,
      p_min: p.min,
      p_require_kyc: p.requireKyc,
      p_networks: p.networks,
      p_coins: p.coins,
      // L'auth admin non porta un'identità (segreto condiviso): si registra il
      // canale. Upgrade: un'identità per admin in lib/admin-session.
      p_created_by: "admin",
    });
  } catch (e) {
    console.error("[admin/affiliate/payouts] create failed:", String(e));
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
  if (!res.ok) return NextResponse.json(res, { status: 409 });
  console.log(`[admin/affiliate/payouts] created ${ids.length} payouts month=${m.month} total=${expected}`);
  return NextResponse.json(res);
}
