// lib/affiliate/account.ts — #AFFILIATE-V2-CRYPTO-1007 PR-5
// Lettura dell'account affiliato per /api/affiliate/me e /api/affiliate/wallet.
//
// Regola anti-IDOR: ogni query qui prende l'`affiliate_id` risolto dalla
// SESSIONE (loadAffiliateBySession), mai un id arrivato dal client. Le rotte non
// accettano id di affiliato, wallet o payout in input.
//
// Cosa non esce mai verso l'affiliato: l'indirizzo intero del wallet (solo
// mascherato), l'email dei referiti (mascherata QUI, lato server), il motivo
// libero di un annullo admin (`cancel_reason`: esce solo `cancel_code`).

import { createHmac } from "node:crypto";
import { dbQueryStrict } from "@/lib/db";
import { explorerTxUrl, maskAddress, type PayoutCoin, type PayoutNetwork } from "./wallet";

export type AffiliateStatus = "active" | "suspended" | "terminated";

export type AffiliateRow = {
  id: number;
  identifier: string;
  code: string;
  status: AffiliateStatus;
  terms_version: string;
  created_at: string;
  payee_legal_name: string | null;
  payee_country: string | null;
  payee_sanctions_declared_at: string | null;
  payee_tax_declared_at: string | null;
};

/** Gli identifier di `affiliates` sono LOWER(TRIM) (CHECK della migration). */
export function affiliateIdentifier(sessionIdentifier: string): string {
  return sessionIdentifier.trim().toLowerCase();
}

export async function loadAffiliateBySession(sessionIdentifier: string): Promise<AffiliateRow | null> {
  const rows = await dbQueryStrict<AffiliateRow & { id: number | string }>(
    `SELECT id, identifier, code, status, terms_version, created_at::text AS created_at,
            payee_legal_name, payee_country,
            payee_sanctions_declared_at::text AS payee_sanctions_declared_at,
            payee_tax_declared_at::text AS payee_tax_declared_at
       FROM affiliates
      WHERE identifier = $1
      LIMIT 1`,
    [affiliateIdentifier(sessionIdentifier)],
  );
  const r = rows[0];
  return r ? { ...r, id: Number(r.id) } : null;
}

// ── Mascheramento ────────────────────────────────────────────────────────────

/** `mario.rossi@gmail.com` → `m***@g***.com`. Non un'email → `ab***`. */
export function maskIdentifier(identifier: string): string {
  const s = (identifier ?? "").trim();
  const at = s.lastIndexOf("@");
  if (at <= 0) return s.length <= 2 ? "***" : `${s.slice(0, 2)}***`;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const tld = dot > 0 ? domain.slice(dot) : "";
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  return `${local[0]}***@${host ? host[0] : ""}***${tld}`;
}

/** HMAC dell'IP (AFFILIATE_HASH_SECRET), come affiliate_clicks. Senza segreto: null. */
export function hashIp(ip: string, secret = process.env.AFFILIATE_HASH_SECRET): string | null {
  if (!secret || secret.length < 16 || !ip || ip === "unknown") return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

// ── Wallet ───────────────────────────────────────────────────────────────────

export type WalletRow = {
  id: number | string;
  coin: PayoutCoin;
  network: PayoutNetwork;
  address: string;
  created_at: string;
  usable_after: string;
  screening_result: "clear" | "not_screened";
};

export type WalletState = "none" | "cooldown" | "pending_screening" | "active" | "suspended";

export type WalletView = {
  state: WalletState;
  /** true solo se oggi un payout può partire verso questo wallet. */
  payable: boolean;
  address_masked: string | null;
  coin: PayoutCoin | null;
  network: PayoutNetwork | null;
  created_at: string | null;
  usable_after: string | null;
  screened: boolean;
};

export async function loadActiveWallet(affiliateId: number): Promise<WalletRow | null> {
  const rows = await dbQueryStrict<WalletRow>(
    `SELECT id, coin, network, address, created_at::text AS created_at,
            usable_after::text AS usable_after, screening_result
       FROM affiliate_wallets
      WHERE affiliate_id = $1 AND revoked_at IS NULL
      LIMIT 1`,
    [affiliateId],
  );
  return rows[0] ?? null;
}

/** Stato derivato (SPEC-ui §2.3): non esiste una colonna `status` sul wallet. */
export function walletView(w: WalletRow | null, affiliateStatus: AffiliateStatus, now = new Date()): WalletView {
  const screened = w?.screening_result === "clear";
  const cooling = w ? new Date(w.usable_after).getTime() > now.getTime() : false;
  let state: WalletState;
  if (affiliateStatus !== "active") state = "suspended";
  else if (!w) state = "none";
  else if (cooling) state = "cooldown";
  else if (!screened) state = "pending_screening";
  else state = "active";
  return {
    state,
    payable: state === "active",
    address_masked: w ? maskAddress(w.address) : null,
    coin: w?.coin ?? null,
    network: w?.network ?? null,
    created_at: w?.created_at ?? null,
    usable_after: w?.usable_after ?? null,
    screened,
  };
}

// ── Ledger ───────────────────────────────────────────────────────────────────

export type LedgerGroup = {
  status: string;
  kind: string;
  total: string | number;
  n: number | string;
  next_after: string | null;
};

export type LedgerView = {
  pending: number;
  /** Maturato netto dei clawback, mai sotto zero (la cella «Maturata»). */
  payable: number;
  /** Se il netto è negativo: quanto si scala dai prossimi incassi (≤ 0). */
  to_recover: number;
  in_payout: number;
  paid: number;
  /** Totale storni/clawback (≤ 0), già tolto dai totali sopra. */
  reversed: number;
  count: number;
  next_payable_after: string | null;
  min_payout_usd: number;
};

const cents = (v: string | number): number => Math.round(Number(v) * 100);

/** Somme per stato, in centesimi interi (niente errori di virgola mobile). */
export function ledgerView(groups: LedgerGroup[], minPayoutUsd: number): LedgerView {
  const sum = { pending: 0, payable: 0, in_payout: 0, paid: 0, reversed: 0 };
  let count = 0;
  let next: string | null = null;
  for (const g of groups) {
    const c = cents(g.total);
    count += Number(g.n) || 0;
    if (g.kind === "reversal" || g.kind === "clawback") sum.reversed += c;
    if (g.status === "pending") {
      sum.pending += c;
      if (g.next_after && (!next || g.next_after < next)) next = g.next_after;
    } else if (g.status === "payable") sum.payable += c;
    else if (g.status === "in_payout") sum.in_payout += c;
    else if (g.status === "paid") sum.paid += c;
  }
  return {
    pending: sum.pending / 100,
    payable: Math.max(0, sum.payable) / 100,
    to_recover: Math.min(0, sum.payable) / 100,
    in_payout: sum.in_payout / 100,
    paid: sum.paid / 100,
    reversed: sum.reversed / 100,
    count,
    next_payable_after: next,
    min_payout_usd: minPayoutUsd,
  };
}

export async function loadLedgerGroups(affiliateId: number): Promise<LedgerGroup[]> {
  // `shadow` non ha UI (F1): le righe di prova non compaiono mai all'affiliato.
  return dbQueryStrict<LedgerGroup>(
    `SELECT status, kind, SUM(amount_usd)::text AS total, COUNT(*)::int AS n,
            MIN(payable_after)::text AS next_after
       FROM affiliate_commissions
      WHERE affiliate_id = $1 AND status <> 'shadow'
      GROUP BY status, kind`,
    [affiliateId],
  );
}

// ── Storico commissioni (paginato) ───────────────────────────────────────────

type CommissionRow = {
  id: number | string;
  referred_identifier: string;
  kind: string;
  created_at: string;
  net_usd: string | number;
  amount_usd: string | number;
  status: string;
  income_at: string;
  payable_after: string;
  paid_out_at: string | null;
};

export type CommissionView = {
  id: number;
  referred: string;
  kind: string;
  created_at: string;
  base_usd: number;
  amount_usd: number;
  status: string;
  income_at: string;
  payable_after: string;
  paid_out_at: string | null;
};

export const COMMISSIONS_PAGE = 20;

export async function loadCommissionsPage(
  affiliateId: number,
  cursor: number | null,
  limit = COMMISSIONS_PAGE,
): Promise<{ items: CommissionView[]; next_cursor: number | null }> {
  const rows = await dbQueryStrict<CommissionRow>(
    `SELECT c.id, c.referred_identifier, c.kind, c.created_at::text AS created_at,
            c.net_usd, c.amount_usd, c.status, c.paid_at::text AS income_at,
            c.payable_after::text AS payable_after, p.paid_at::text AS paid_out_at
       FROM affiliate_commissions c
       LEFT JOIN affiliate_payouts p ON p.id = c.payout_id AND p.status = 'paid'
      WHERE c.affiliate_id = $1 AND c.status <> 'shadow'
        AND ($2::bigint IS NULL OR c.id < $2::bigint)
      ORDER BY c.id DESC
      LIMIT $3`,
    [affiliateId, cursor, limit + 1],
  );
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: Number(r.id),
      referred: maskIdentifier(r.referred_identifier),
      kind: r.kind,
      created_at: r.created_at,
      base_usd: Number(r.net_usd),
      amount_usd: Number(r.amount_usd),
      status: r.status,
      income_at: r.income_at,
      payable_after: r.payable_after,
      paid_out_at: r.paid_out_at,
    })),
    next_cursor: rows.length > limit && page.length > 0 ? Number(page[page.length - 1].id) : null,
  };
}

/** Cursore dalla query string: intero positivo o null. Altro → null (prima pagina). */
export function parseCursor(raw: string | null): number | null {
  if (!raw || !/^[1-9][0-9]{0,15}$/.test(raw)) return null;
  return Number(raw);
}

// ── Storico pagamenti ────────────────────────────────────────────────────────

type PayoutRow = {
  id: number | string;
  period_month: string;
  amount_usd: string | number;
  coin: PayoutCoin;
  network: PayoutNetwork;
  amount_coin: string | number | null;
  status: "created" | "submitted" | "paid" | "cancelled";
  tx_hash: string | null;
  paid_at: string | null;
  cancel_code: "wallet_changed" | "wallet_removed" | "admin_cancelled" | null;
};

export type PayoutView = {
  id: number;
  period_month: string;
  amount_usd: number;
  coin: PayoutCoin;
  network: PayoutNetwork;
  amount_coin: number | null;
  status: PayoutRow["status"];
  tx_hash: string | null;
  explorer_url: string | null;
  paid_at: string | null;
  cancel_code: PayoutRow["cancel_code"];
};

export function payoutView(r: PayoutRow): PayoutView {
  return {
    id: Number(r.id),
    period_month: r.period_month,
    amount_usd: Number(r.amount_usd),
    coin: r.coin,
    network: r.network,
    // Solo dopo la lettura on-chain (paid): prima non è un dato, è una stima.
    amount_coin: r.status === "paid" && r.amount_coin != null ? Number(r.amount_coin) : null,
    status: r.status,
    tx_hash: r.tx_hash,
    explorer_url: r.tx_hash ? explorerTxUrl(r.network, r.tx_hash) : null,
    paid_at: r.paid_at,
    cancel_code: r.cancel_code,
  };
}

export async function loadPayouts(affiliateId: number): Promise<PayoutView[]> {
  // Elenco esplicito delle colonne: `cancel_reason` (testo libero admin) e
  // `to_address` (indirizzo intero) non vengono nemmeno letti.
  const rows = await dbQueryStrict<PayoutRow>(
    `SELECT id, period_month::text AS period_month, amount_usd, coin, network, amount_coin,
            status, tx_hash, paid_at::text AS paid_at, cancel_code
       FROM affiliate_payouts
      WHERE affiliate_id = $1
      ORDER BY period_month DESC, id DESC
      LIMIT 60`,
    [affiliateId],
  );
  return rows.map(payoutView);
}

export function payeeView(a: AffiliateRow): {
  name: string | null;
  country: string | null;
  declarations: { sanctions_at: string | null; tax_at: string | null };
} {
  return {
    name: a.payee_legal_name,
    country: a.payee_country,
    declarations: { sanctions_at: a.payee_sanctions_declared_at, tax_at: a.payee_tax_declared_at },
  };
}
