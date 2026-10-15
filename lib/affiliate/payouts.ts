// lib/affiliate/payouts.ts — #AFFILIATE-V2-CRYPTO-1007 PR-9
// Lato admin dei payout manuali: lettura del mese, parsing degli input, e la
// registrazione del tx hash (verifica on-chain → funzione SQL → email).
//
// Le regole di eleggibilità NON stanno qui: stanno in una sola funzione SQL
// (affiliate_payout_rows), letta sia dall'anteprima sia dalla creazione dentro
// la transazione. Qui si leggono i suoi risultati e basta.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, dbQueryStrict } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { affiliateConfig, affiliatePolygonRpcUrl, affiliatePayoutsMode, payoutConfig } from "./config";
import { payoutPaidEmail, type Mail } from "./emails";
import { jsonRpc, verifyPayoutTx, VerifierUnavailableError, type Rpc } from "./payout-verify";
import { affiliateRpc } from "./rpc";
import { explorerTxUrl, maskAddress, normalizeTxHash, type PayoutCoin, type PayoutNetwork } from "./wallet";

// ── Guardia admin (stesso schema di app/api/admin/activations) ──────────────

/** null = passa. Mutating: blocca anche le chiamate cross-site (CSRF via cookie admin). */
export async function adminGuard(req: NextRequest, mutating: boolean): Promise<NextResponse | null> {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (mutating && req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  return null;
}

/** AFFILIATE_PAYOUTS=off (default) spegne creazione e registrazione, non la lettura. */
export function payoutsOff(): NextResponse | null {
  return affiliatePayoutsMode() === "live"
    ? null
    : NextResponse.json({ error: "payouts_off" }, { status: 403 });
}

// ── Input ────────────────────────────────────────────────────────────────────

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** "2026-10" → primo del mese. Null se malformato o fuori dal 2026–2100. */
export function parseMonth(raw: string | null | undefined): { month: string; period: string } | null {
  const m = /^(20[2-9][0-9])-(0[1-9]|1[0-2])$/.exec((raw ?? "").trim());
  if (!m || Number(m[1]) < 2026) return null;
  return { month: `${m[1]}-${m[2]}`, period: `${m[1]}-${m[2]}-01` };
}

/** Id di affiliati: interi positivi, distinti, 1–500. */
export function parseIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) return null;
  const ids = raw.map((x) => (typeof x === "number" ? x : typeof x === "string" && /^\d+$/.test(x) ? Number(x) : NaN));
  if (ids.some((n) => !Number.isSafeInteger(n) || n <= 0)) return null;
  return [...new Set(ids)];
}

/** Totale atteso in dollari, al centesimo: "349.2" / 349.2 → "349.20". */
export function parseExpectedTotal(raw: unknown): string | null {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s).toFixed(2);
}

/** Lista di valori da allowlist → letterale array Postgres per exec_sql. */
export function pgTextArray(list: readonly string[]): string {
  if (list.some((v) => !/^[A-Za-z0-9_]+$/.test(v))) throw new Error("pgTextArray: unsafe value");
  return `{${list.join(",")}}`;
}

/** Parametri comuni a anteprima e creazione: devono essere gli stessi. */
export function eligibilityParams() {
  const pc = payoutConfig();
  return {
    min: affiliateConfig().minPayoutUsd,
    requireKyc: pc.kycAtWallet,
    networks: pc.networks,
    coins: pc.coins,
  };
}

// ── Lettura del mese ─────────────────────────────────────────────────────────

type PayoutRowDb = {
  affiliate_id: number | string;
  code: string;
  status: string;
  payee_legal_name: string | null;
  payee_country: string | null;
  sanctions_declared: boolean;
  tax_declared: boolean;
  balance: number | string;
  wallet_id: number | string | null;
  address: string | null;
  coin: PayoutCoin | null;
  network: PayoutNetwork | null;
  wallet_created_at: string | null;
  usable_after: string | null;
  screening_result: string | null;
  paid_in_year: number | string;
  payout_id: number | string | null;
  payout_status: string | null;
  payout_amount: number | string | null;
  reasons: string[] | null;
};

export type AdminPayoutRow = {
  affiliate_id: number;
  code: string;
  status: string;
  payee: { name: string | null; country: string | null };
  checks: { payee: boolean; screened: boolean; declarations: boolean };
  balance_usd: number;
  paid_in_year_usd: number;
  wallet: {
    address: string;
    address_masked: string;
    coin: PayoutCoin | null;
    network: PayoutNetwork | null;
    created_at: string | null;
    usable_after: string | null;
    screening_result: string | null;
  } | null;
  payout: { id: number; status: string; amount_usd: number } | null;
  eligible: boolean;
  reasons: string[];
};

export function adminRowView(r: PayoutRowDb): AdminPayoutRow {
  const reasons = r.reasons ?? [];
  return {
    affiliate_id: Number(r.affiliate_id),
    code: r.code,
    status: r.status,
    payee: { name: r.payee_legal_name, country: r.payee_country },
    checks: {
      payee: Boolean(r.payee_legal_name && r.payee_country),
      screened: r.screening_result === "clear",
      declarations: Boolean(r.sanctions_declared && r.tax_declared),
    },
    balance_usd: Number(r.balance),
    paid_in_year_usd: Number(r.paid_in_year),
    // L'admin vede l'indirizzo intero: lo copia per l'invio (SPEC-ui §4.2).
    wallet: r.address
      ? {
          address: r.address,
          address_masked: maskAddress(r.address),
          coin: r.coin,
          network: r.network,
          created_at: r.wallet_created_at,
          usable_after: r.usable_after,
          screening_result: r.screening_result,
        }
      : null,
    payout: r.payout_id != null ? { id: Number(r.payout_id), status: String(r.payout_status), amount_usd: Number(r.payout_amount) } : null,
    eligible: reasons.length === 0,
    reasons,
  };
}

export async function loadMonthRows(period: string): Promise<AdminPayoutRow[]> {
  const p = eligibilityParams();
  const rows = await dbQueryStrict<PayoutRowDb>(
    `SELECT * FROM affiliate_payout_rows($1::date, $2::numeric, $3::boolean, $4::text[], $5::text[])`,
    [period, p.min, p.requireKyc, pgTextArray(p.networks), pgTextArray(p.coins)],
  );
  return rows.map(adminRowView);
}

export function monthSummary(rows: AdminPayoutRow[]) {
  const eligible = rows.filter((r) => r.eligible);
  const cents = eligible.reduce((s, r) => s + Math.round(r.balance_usd * 100), 0);
  return {
    eligible_count: eligible.length,
    eligible_total_usd: cents / 100,
    // D2: il wallet di uscita va ricaricato del solo importo del mese.
    to_fund_usd: cents / 100,
    prepared_count: rows.filter((r) => r.payout?.status === "created").length,
  };
}

// ── Un payout ────────────────────────────────────────────────────────────────

export type AdminPayout = {
  id: number;
  affiliate_id: number;
  affiliate_identifier: string;
  affiliate_code: string;
  affiliate_status: string;
  payee: { name: string | null; country: string | null };
  period_month: string;
  amount_usd: number;
  coin: PayoutCoin;
  network: PayoutNetwork;
  to_address: string;
  amount_coin: number | null;
  tx_hash: string | null;
  explorer_url: string | null;
  status: "created" | "submitted" | "paid" | "cancelled";
  created_at: string;
  submitted_at: string | null;
  paid_at: string | null;
  cancel_code: string | null;
  cancel_reason: string | null;
};

export function parsePayoutId(raw: string): number | null {
  return /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;
}

export async function loadPayout(id: number): Promise<AdminPayout | null> {
  const rows = await dbQueryStrict<AdminPayout & { id: number | string; affiliate_id: number | string; payee_name: string | null; payee_country: string | null }>(
    `SELECT p.id, p.affiliate_id, a.identifier AS affiliate_identifier, a.code AS affiliate_code,
            a.status AS affiliate_status, a.payee_legal_name AS payee_name, a.payee_country,
            p.period_month::text AS period_month, p.amount_usd, p.coin, p.network, p.to_address,
            p.amount_coin, p.tx_hash, p.status, p.created_at::text AS created_at,
            p.submitted_at::text AS submitted_at, p.paid_at::text AS paid_at, p.cancel_code, p.cancel_reason
       FROM affiliate_payouts p JOIN affiliates a ON a.id = p.affiliate_id
      WHERE p.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    affiliate_id: Number(r.affiliate_id),
    affiliate_identifier: r.affiliate_identifier,
    affiliate_code: r.affiliate_code,
    affiliate_status: r.affiliate_status,
    payee: { name: r.payee_name, country: r.payee_country },
    period_month: r.period_month,
    amount_usd: Number(r.amount_usd),
    coin: r.coin,
    network: r.network,
    to_address: r.to_address,
    amount_coin: r.amount_coin != null ? Number(r.amount_coin) : null,
    tx_hash: r.tx_hash,
    explorer_url: r.tx_hash ? explorerTxUrl(r.network, r.tx_hash) : null,
    status: r.status,
    created_at: r.created_at,
    submitted_at: r.submitted_at,
    paid_at: r.paid_at,
    cancel_code: r.cancel_code,
    cancel_reason: r.cancel_reason,
  };
}

/** Per l'admin: il payout senza l'identifier (email) dell'affiliato. */
export function adminPayoutView(p: AdminPayout) {
  const { affiliate_identifier: _omit, ...rest } = p;
  void _omit;
  return rest;
}

export async function notifyAffiliate(identifier: string, mail: Mail): Promise<void> {
  try {
    await sendEmail({ to: identifier, subject: mail.subject, html: mail.html, text: mail.text, replyTo: mail.replyTo });
  } catch (e) {
    console.error("[affiliate/payouts] notification email failed:", String(e));
  }
}

export async function mailLangOf(identifier: string): Promise<string | null> {
  const rows = await dbQuery<{ language: string | null }>(
    "SELECT language FROM profiles WHERE LOWER(TRIM(identifier)) = $1 ORDER BY created_at ASC LIMIT 1",
    [identifier],
  );
  return rows[0]?.language ?? null;
}

// ── Registrazione del tx hash ────────────────────────────────────────────────

/**
 * Verifica on-chain `hash` per il payout e, se coerente, lo registra.
 * Un hash rifiutato non si registra mai: il payout resta com'era.
 * `rpc` iniettabile per i test (nessuna chiamata di rete reale).
 */
export async function registerPayoutTx(
  payout: AdminPayout,
  rawHash: unknown,
  rpc: Rpc = jsonRpc(affiliatePolygonRpcUrl()),
): Promise<NextResponse> {
  const hash = normalizeTxHash(payout.network, rawHash);
  if (!hash) return NextResponse.json({ outcome: "rejected", reason: "invalid_format" }, { status: 422 });

  if (payout.status === "cancelled") {
    // Caso da gestire a mano: se i fondi sono già partiti verso il vecchio
    // indirizzo, l'hash non si può registrare su un payout annullato.
    return NextResponse.json({ error: "cancelled", cancel_code: payout.cancel_code }, { status: 409 });
  }
  if (payout.status === "paid") {
    return payout.tx_hash === hash
      ? NextResponse.json({ outcome: "paid", payout_id: payout.id, already: true })
      : NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  if (payout.status === "submitted" && payout.tx_hash !== hash) {
    return NextResponse.json({ error: "hash_mismatch" }, { status: 409 });
  }

  const from = payoutConfig().payoutFrom;
  if (!from) return NextResponse.json({ error: "payout_from_not_configured" }, { status: 503 });

  let verdict;
  try {
    verdict = await verifyPayoutTx(
      { network: payout.network, coin: payout.coin, txHash: hash, from, to: payout.to_address, amountUsd: payout.amount_usd },
      rpc,
    );
  } catch (e) {
    if (e instanceof VerifierUnavailableError) {
      console.error(`[affiliate/payouts] verifier unavailable for payout=${payout.id}:`, e.message);
      return NextResponse.json({ error: "verifier_unavailable" }, { status: 503 });
    }
    throw e;
  }
  if (verdict.outcome === "rejected") {
    console.warn(`[affiliate/payouts] tx rejected payout=${payout.id} reason=${verdict.reason} to=${maskAddress(payout.to_address)}`);
    return NextResponse.json({ outcome: "rejected", reason: verdict.reason }, { status: 422 });
  }

  const paid = verdict.outcome === "paid";
  const res = await affiliateRpc<{ ok: boolean; error?: string; status?: string; became_paid?: boolean }>(
    "affiliate_payout_record_tx",
    { p_id: payout.id, p_tx_hash: hash, p_paid: paid, p_amount_coin: verdict.amountCoin },
  );
  if (!res.ok) return NextResponse.json({ error: res.error ?? "record_failed" }, { status: 409 });

  if (res.became_paid) {
    const explorer = explorerTxUrl(payout.network, hash);
    await notifyAffiliate(
      payout.affiliate_identifier,
      payoutPaidEmail({
        lang: await mailLangOf(payout.affiliate_identifier),
        amountUsd: payout.amount_usd,
        amountCoin: verdict.amountCoin,
        coin: payout.coin,
        explorerUrl: explorer,
      }),
    );
  }
  console.log(`[affiliate/payouts] tx recorded payout=${payout.id} status=${res.status} confirmations=${verdict.confirmations}`);
  return NextResponse.json({
    outcome: res.status,
    payout_id: payout.id,
    confirmations: verdict.confirmations,
    required: verdict.outcome === "submitted" ? verdict.required : undefined,
    amount_coin: verdict.amountCoin,
    explorer_url: explorerTxUrl(payout.network, hash),
  });
}
