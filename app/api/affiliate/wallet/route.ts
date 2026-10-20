// /api/affiliate/wallet — #AFFILIATE-V2-CRYPTO-1007 PR-5 (SPEC-ui §2.3, §3.3, §3.4, §12).
//
// GET    → wallet attivo MASCHERATO + stato derivato, beneficiario, rail accesi.
// PUT    → registra o cambia il wallet. Il server è l'arbitro:
//          validatePayoutWallet (formato per rete + EIP-55 + rail accesi D1/D5),
//          ultime 6 cifre se inviate, conferma di rete, KYC minimo D3 (nome legale,
//          paese, due autodichiarazioni separate), screening dell'indirizzo
//          (fail-closed, nessun provider integrato → `not_screened`, non pagabile).
//          Poi UNA transazione SQL (affiliate_set_wallet): revoca il vecchio, il
//          nuovo è utilizzabile dopo 72 h, annulla un payout `created`. Email
//          «wallet cambiato» all'account.
// DELETE → rimuove il wallet senza sostituirlo (stessa transazione di annullo).
//
// `suspended` blocca PUT (403). Anti-IDOR: tutto è risolto dalla sessione.
// Mai un indirizzo intero nei log: solo maskAddress.

import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { affiliateMode, affiliateTermsVersion, payoutConfig, payoutDeniedAddresses } from "@/lib/affiliate/config";
import {
  affiliateIdentifier,
  hashIp,
  loadActiveWallet,
  loadAffiliateBySession,
  payeeView,
  walletView,
  type AffiliateRow,
} from "@/lib/affiliate/account";
import { walletChangedEmail } from "@/lib/affiliate/emails";
import { affiliateRpc } from "@/lib/affiliate/rpc";
import { ScreeningUnavailableError, screenPayoutAddress } from "@/lib/affiliate/screening";
import { cleanCountry, cleanLegalName } from "@/lib/affiliate/payee";
import { maskAddress, validatePayoutWallet } from "@/lib/affiliate/wallet";

export const dynamic = "force-dynamic";

const HOUR = 3_600_000;

type Ctx = { identifier: string };

async function resolve(req: Request): Promise<{ ctx: Ctx; aff: AffiliateRow } | NextResponse> {
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[affiliate/wallet] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  const aff = await loadAffiliateBySession(ctx.identifier);
  if (!aff) return NextResponse.json({ error: "not_enrolled" }, { status: 404 });
  return { ctx, aff };
}

/** Scritture: per affiliato e per IP (lib/rate-limit, best-effort per istanza). */
function limited(req: Request, identifier: string): boolean {
  return (
    rateLimit(`aff-wallet:${affiliateIdentifier(identifier)}`, 5, HOUR) ||
    rateLimit(`aff-wallet-ip:${clientIp(req)}`, 20, HOUR)
  );
}

async function notify(identifier: string, mail: ReturnType<typeof walletChangedEmail>): Promise<void> {
  // L'email è un avviso anti account-takeover, non una condizione del cambio:
  // il wallet è già salvato. Un invio fallito si logga e basta.
  try {
    await sendEmail({ to: identifier, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo });
  } catch (e) {
    console.error("[affiliate/wallet] notification email failed:", String(e));
  }
}

async function mailLang(identifier: string): Promise<string | null> {
  const rows = await dbQuery<{ language: string | null }>(
    "SELECT language FROM profiles WHERE identifier = $1 LIMIT 1",
    [identifier],
  );
  return rows[0]?.language ?? null;
}

export async function GET(req: Request) {
  try {
    const r = await resolve(req);
    if (r instanceof NextResponse) return r;
    const pc = payoutConfig();
    return NextResponse.json({
      wallet: walletView(await loadActiveWallet(r.aff.id), r.aff.status),
      payee: payeeView(r.aff),
      rails: { coins: pc.coins, networks: pc.networks },
    });
  } catch (e) {
    console.error("[affiliate/wallet] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

type PutBody = {
  coin?: unknown;
  network?: unknown;
  address?: unknown;
  last6?: unknown;
  payee_legal_name?: unknown;
  payee_country?: unknown;
  declarations?: { sanctions?: unknown; tax?: unknown } | null;
  network_ack?: unknown;
};

const fail = (error: string, status = 422, field?: string) =>
  NextResponse.json(field ? { error, field } : { error }, { status });

export async function PUT(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let r;
  try {
    r = await resolve(req);
  } catch (e) {
    console.error("[affiliate/wallet] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (r instanceof NextResponse) return r;
  const { ctx, aff } = r;

  if (affiliateMode() === "off") return fail("program_closed", 403);
  // `suspended` (e `terminated`) non cambiano wallet: SPEC-ui §2.3.
  if (aff.status !== "active") return fail(aff.status, 403);
  if (limited(req, ctx.identifier)) return fail("too_many_requests", 429);

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return fail("invalid json", 400);
  }
  if (!body || typeof body !== "object") return fail("invalid json", 400);

  const pc = payoutConfig();
  // Rail fisso (D1/D5: un solo valore acceso) → il client può ometterlo.
  const coin = body.coin ?? (pc.coins.length === 1 ? pc.coins[0] : undefined);
  const network = body.network ?? (pc.networks.length === 1 ? pc.networks[0] : undefined);
  const verdict = validatePayoutWallet({ coin, network, address: body.address }, pc);
  if (!verdict.ok) return fail(verdict.reason, 422, "address");
  if (payoutDeniedAddresses().has(verdict.address.toLowerCase())) return fail("address_not_allowed", 422, "address");

  if (body.last6 !== undefined) {
    const last6 = typeof body.last6 === "string" ? body.last6.trim().toLowerCase() : "";
    if (last6.length !== 6 || !verdict.address.toLowerCase().endsWith(last6)) {
      return fail("last6_mismatch", 422, "last6");
    }
  }
  if (body.network_ack !== true) return fail("network_ack_required", 422, "network_ack");

  let legalName: string | null = null;
  let country: string | null = null;
  // Le dichiarazioni D3 si registrano solo col KYC acceso: senza nome/paese il
  // CHECK di affiliates le rifiuterebbe (QA F8: era un 500).
  const declared = pc.kycAtWallet && body.declarations?.sanctions === true && body.declarations?.tax === true;
  if (pc.kycAtWallet) {
    legalName = cleanLegalName(body.payee_legal_name);
    if (!legalName) return fail("invalid_legal_name", 422, "payee_legal_name");
    country = cleanCountry(body.payee_country);
    if (!country) return fail("invalid_country", 422, "payee_country");
    if (body.declarations?.sanctions !== true) return fail("declaration_required", 422, "declarations.sanctions");
    if (body.declarations?.tax !== true) return fail("declaration_required", 422, "declarations.tax");
  }
  const termsVersion = affiliateTermsVersion();
  if (declared && !termsVersion) return fail("terms_not_published", 503);

  const masked = maskAddress(verdict.address);
  let screening;
  try {
    screening = await screenPayoutAddress(verdict.network, verdict.address);
  } catch (e) {
    if (e instanceof ScreeningUnavailableError) {
      console.error(`[affiliate/wallet] screening unavailable for ${masked}:`, e.message);
      // Fail-closed: niente salvato, il wallet precedente resta com'è.
      return fail("screening_unavailable", 503);
    }
    throw e;
  }
  if (screening.kind === "blocked") {
    console.warn(`[affiliate/wallet] address_blocked affiliate=${aff.id} address=${masked} provider=${screening.provider}`);
    // Nessun dettaglio sull'esito verso l'affiliato (SPEC-ui §3.3).
    return fail("address_blocked", 422, "address");
  }

  let res;
  try {
    res = await affiliateRpc<{ ok: boolean; error?: string; usable_after?: string; cancelled_payout_ids?: number[] }>(
      "affiliate_set_wallet",
      {
        p_affiliate_id: aff.id,
        p_coin: verdict.coin,
        p_network: verdict.network,
        p_address: verdict.address,
        p_ip_hash: hashIp(clientIp(req)),
        p_screening_result: screening.kind,
        p_screening_provider: screening.kind === "clear" ? screening.provider : null,
        p_legal_name: legalName,
        p_country: country,
        p_declared: declared,
        p_declarations_version: declared ? termsVersion : null,
        p_require_kyc: pc.kycAtWallet,
      },
    );
  } catch (e) {
    console.error(`[affiliate/wallet] save failed for affiliate=${aff.id} address=${masked}:`, String(e));
    return fail("save_failed", 500);
  }
  if (!res.ok) {
    const err = res.error ?? "save_failed";
    return fail(err, err === "suspended" || err === "terminated" ? 403 : 409);
  }

  const cancelled = (res.cancelled_payout_ids ?? []).length;
  console.log(`[affiliate/wallet] wallet set affiliate=${aff.id} address=${masked} screening=${screening.kind} cancelled_payouts=${cancelled}`);
  await notify(
    ctx.identifier,
    walletChangedEmail({
      lang: await mailLang(ctx.identifier),
      removed: false,
      addressMasked: masked,
      coin: verdict.coin,
      network: verdict.network,
      usableAfterISO: res.usable_after ?? null,
      payoutCancelled: cancelled > 0,
    }),
  );

  let wallet;
  try {
    wallet = walletView(await loadActiveWallet(aff.id), aff.status);
  } catch {
    wallet = null; // salvato davvero: la rilettura è solo comodità per la UI
  }
  return NextResponse.json({ ok: true, wallet, cancelled_payouts: cancelled });
}

export async function DELETE(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let r;
  try {
    r = await resolve(req);
  } catch (e) {
    console.error("[affiliate/wallet] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (r instanceof NextResponse) return r;
  const { ctx, aff } = r;
  if (limited(req, ctx.identifier)) return fail("too_many_requests", 429);

  let res;
  try {
    res = await affiliateRpc<{ ok: boolean; error?: string; cancelled_payout_ids?: number[] }>(
      "affiliate_revoke_wallet",
      { p_affiliate_id: aff.id },
    );
  } catch (e) {
    console.error(`[affiliate/wallet] revoke failed for affiliate=${aff.id}:`, String(e));
    return fail("save_failed", 500);
  }
  if (!res.ok) return fail(res.error ?? "save_failed", res.error === "no_wallet" ? 404 : 409);

  const cancelled = (res.cancelled_payout_ids ?? []).length;
  console.log(`[affiliate/wallet] wallet removed affiliate=${aff.id} cancelled_payouts=${cancelled}`);
  await notify(
    ctx.identifier,
    walletChangedEmail({
      lang: await mailLang(ctx.identifier),
      removed: true,
      addressMasked: null,
      usableAfterISO: null,
      payoutCancelled: cancelled > 0,
    }),
  );
  return NextResponse.json({ ok: true, wallet: walletView(null, aff.status), cancelled_payouts: cancelled });
}
