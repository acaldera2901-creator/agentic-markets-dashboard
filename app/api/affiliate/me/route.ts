// /api/affiliate/me — #AFFILIATE-V2-CRYPTO-1007 PR-5 (SPEC-ui §2, §3.2, §3.5, §12).
//
// GET → tutto il pannello dell'affiliato loggato, in una lettura:
//   ledger per stato, wallet MASCHERATO con stato derivato, beneficiario, rail
//   accesi, storico pagamenti (explorer_url, cancel_code enumerato), storico
//   commissioni paginato (?cursor=<id>) con i referiti mascherati LATO SERVER.
// Non iscritto → 200 { enrolled:false } (la UI mostra l'iscrizione).
// Errore di lettura → 500: la UI NON deve offrire l'iscrizione su un errore
// (lezione #REFERRAL-KPI-0808), quindi un errore non diventa mai enrolled:false.
//
// Anti-IDOR: l'affiliato è risolto dalla sessione; nessun id arriva dal client.

import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { affiliateConfig, affiliateMode, affiliateTermsVersion, payoutConfig } from "@/lib/affiliate/config";
import {
  ledgerView,
  loadActiveWallet,
  loadAffiliateBySession,
  loadCommissionsPage,
  loadLedgerGroups,
  loadPayouts,
  parseCursor,
  payeeView,
  walletView,
} from "@/lib/affiliate/account";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[affiliate/me] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });

  try {
    const aff = await loadAffiliateBySession(ctx.identifier);
    if (!aff) {
      return NextResponse.json({
        enrolled: false,
        open: affiliateMode() !== "off" && affiliateTermsVersion() !== null,
      });
    }
    const cursor = parseCursor(new URL(req.url).searchParams.get("cursor"));
    const [wallet, groups, payouts, commissions] = await Promise.all([
      loadActiveWallet(aff.id),
      loadLedgerGroups(aff.id),
      loadPayouts(aff.id),
      loadCommissionsPage(aff.id, cursor),
    ]);
    const pc = payoutConfig();
    return NextResponse.json({
      enrolled: true,
      affiliate: { code: aff.code, status: aff.status, terms_version: aff.terms_version, created_at: aff.created_at },
      ledger: ledgerView(groups, affiliateConfig().minPayoutUsd),
      wallet: walletView(wallet, aff.status),
      payee: payeeView(aff),
      rails: { coins: pc.coins, networks: pc.networks },
      payouts,
      commissions,
    });
  } catch (e) {
    console.error("[affiliate/me] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}
