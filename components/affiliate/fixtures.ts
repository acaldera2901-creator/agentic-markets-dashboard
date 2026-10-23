// components/affiliate/fixtures.ts — SOLO test e prove visive (Playwright con fetch
// intercettato). Dati, importi, indirizzi e hash sono INVENTATI (forma valida,
// nessun wallet reale). Nessun modulo di prodotto importa questo file.
import type { AdminMonth, MeResponse } from "./types";

type Enrolled = Extract<MeResponse, { enrolled: true }>;

export const ADDR_NEW = "0x4b1e9a07c3d85f2e6a90b7c14d3e58f20a6c91d7";
export const TX = "0x7c2e41a9b05d3f68e1a4c7092bd5f3e86a10c4d79e2b58f3a6c0d1e4b7295f83";

const base = (over: Partial<Enrolled> = {}): Enrolled => ({
  enrolled: true,
  affiliate: { code: "ESEMPIO", status: "active", terms_version: "v1", created_at: "2026-09-01T10:00:00Z" },
  ledger: { pending: 41.98, payable: 23.39, to_recover: 0, in_payout: 0, paid: 60, reversed: -6, count: 5, next_payable_after: "2026-11-18T00:00:00Z", min_payout_usd: 50 },
  wallet: { state: "active", payable: true, address_masked: "0x4b1e…91d7", coin: "USDT", network: "polygon", created_at: "2026-10-02T09:00:00Z", usable_after: "2026-10-05T09:00:00Z", screened: true },
  payee: { name: "A. Bianchi", country: "IT", declarations: { sanctions_at: "2026-10-02T09:00:00Z", tax_at: "2026-10-02T09:00:00Z" } },
  rails: { coins: ["USDT"], networks: ["polygon"] },
  // #AFFILIATE-TIERS-1021: 3 referiti paganti → livello base 7%, prossimo gradino a 5 (10%)
  tier: { level: 0, rate: 0.07, base_rate: 0.07, first_rate: 0.2, paying_referred: 3, next: { min: 5, rate: 0.1 }, ladder: [{ min: 5, rate: 0.1 }, { min: 15, rate: 0.15 }] },
  payouts: [
    { id: 3, period_month: "2026-09-01", amount_usd: 60, coin: "USDT", network: "polygon", amount_coin: 60, status: "paid", tx_hash: TX, explorer_url: `https://polygon.blockscout.com/tx/${TX}`, paid_at: "2026-10-05T10:00:00Z", cancel_code: null },
  ],
  commissions: {
    items: [
      { id: 9, referred: "m***@g***.com", kind: "first", created_at: "2026-10-09T10:00:00Z", base_usd: 29.99, amount_usd: 6, status: "pending", income_at: "2026-10-09T10:00:00Z", payable_after: "2026-12-08T00:00:00Z", paid_out_at: null },
      { id: 8, referred: "l***@p***.me", kind: "renewal", created_at: "2026-10-02T10:00:00Z", base_usd: 29.99, amount_usd: 2.1, status: "pending", income_at: "2026-10-02T10:00:00Z", payable_after: "2026-12-01T00:00:00Z", paid_out_at: null },
      { id: 7, referred: "g***@o***.it", kind: "first", created_at: "2026-08-04T10:00:00Z", base_usd: 29.99, amount_usd: 6, status: "payable", income_at: "2026-08-04T10:00:00Z", payable_after: "2026-10-03T00:00:00Z", paid_out_at: null },
      { id: 6, referred: "a***@g***.com", kind: "clawback", created_at: "2026-07-21T10:00:00Z", base_usd: 29.99, amount_usd: -6, status: "reversed", income_at: "2026-07-21T10:00:00Z", payable_after: "2026-07-21T00:00:00Z", paid_out_at: null },
      { id: 5, referred: "f***@i***.com", kind: "renewal", created_at: "2026-07-12T10:00:00Z", base_usd: 29.99, amount_usd: 2.1, status: "paid", income_at: "2026-07-12T10:00:00Z", payable_after: "2026-09-10T00:00:00Z", paid_out_at: "2026-10-05T10:00:00Z" },
    ],
    next_cursor: null,
  },
  ...over,
});

export const ME = base();
export const ME_EMPTY = base({
  ledger: { pending: 0, payable: 0, to_recover: 0, in_payout: 0, paid: 0, reversed: 0, count: 0, next_payable_after: null, min_payout_usd: 50 },
  wallet: { state: "none", payable: false, address_masked: null, coin: null, network: null, created_at: null, usable_after: null, screened: false },
  payee: { name: null, country: null, declarations: { sanctions_at: null, tax_at: null } },
  payouts: [],
  commissions: { items: [], next_cursor: null },
});
export const ME_COOLDOWN = base({
  wallet: { state: "cooldown", payable: false, address_masked: "0x4b1e…91d7", coin: "USDT", network: "polygon", created_at: "2026-10-15T09:00:00Z", usable_after: "2026-10-18T09:00:00Z", screened: true },
});
export const ME_PENDING_SCREENING = base({
  wallet: { state: "pending_screening", payable: false, address_masked: "0x4b1e…91d7", coin: "USDT", network: "polygon", created_at: "2026-10-01T09:00:00Z", usable_after: "2026-10-04T09:00:00Z", screened: false },
});
export const ME_SUSPENDED = base({
  affiliate: { code: "ESEMPIO", status: "suspended", terms_version: "v1", created_at: "2026-09-01T10:00:00Z" },
  wallet: { state: "suspended", payable: false, address_masked: "0x4b1e…91d7", coin: "USDT", network: "polygon", created_at: "2026-10-02T09:00:00Z", usable_after: "2026-10-05T09:00:00Z", screened: true },
});
export const ME_TIER2 = base({
  tier: { level: 2, rate: 0.15, base_rate: 0.07, first_rate: 0.2, paying_referred: 17, next: null, ladder: [{ min: 5, rate: 0.1 }, { min: 15, rate: 0.15 }] },
});
export const ME_NO_TIERS = base({
  tier: { level: 0, rate: 0.07, base_rate: 0.07, first_rate: 0.2, paying_referred: 9, next: null, ladder: [] },
});
export const ME_NEGATIVE = base({
  ledger: { pending: 0, payable: 0, to_recover: -6, in_payout: 0, paid: 60, reversed: -6, count: 3, next_payable_after: null, min_payout_usd: 50 },
});
export const ME_PAYOUTS_ALL = base({
  payouts: [
    { id: 5, period_month: "2026-10-01", amount_usd: 63.4, coin: "USDT", network: "polygon", amount_coin: null, status: "created", tx_hash: null, explorer_url: null, paid_at: null, cancel_code: null },
    { id: 4, period_month: "2026-09-01", amount_usd: 72.1, coin: "USDT", network: "polygon", amount_coin: null, status: "submitted", tx_hash: TX, explorer_url: `https://polygon.blockscout.com/tx/${TX}`, paid_at: null, cancel_code: null },
    { id: 3, period_month: "2026-08-01", amount_usd: 60, coin: "USDT", network: "polygon", amount_coin: 60, status: "paid", tx_hash: TX, explorer_url: `https://polygon.blockscout.com/tx/${TX}`, paid_at: "2026-09-05T10:00:00Z", cancel_code: null },
    { id: 2, period_month: "2026-07-01", amount_usd: 52.3, coin: "USDT", network: "polygon", amount_coin: null, status: "cancelled", tx_hash: null, explorer_url: null, paid_at: null, cancel_code: "wallet_changed" },
  ],
});

export const JOIN_OPEN = { open: true, enrolled: false, status: null, terms_version: "v1", code: null, code_locked: false };

const row = (over: Partial<AdminMonth["rows"][number]>): AdminMonth["rows"][number] => ({
  affiliate_id: 1, code: "ESEMPIO-A", status: "active", payee: { name: "A. Bianchi", country: "IT" },
  checks: { payee: true, screened: true, declarations: true }, balance_usd: 212.4, paid_in_year_usd: 420,
  wallet: { address: "0x" + "4b1e9a07c3d85f2e6a90b7c14d3e58f20a6c91d7", address_masked: "0x4b1e…91d7", coin: "USDT", network: "polygon", created_at: "2026-09-02T09:00:00Z", usable_after: "2026-10-02T09:00:00Z", screening_result: "clear" },
  payout: null, eligible: true, reasons: [], ...over,
});

export const ADMIN: AdminMonth = {
  month: "2026-10", current_month: "2026-10", mode: "live", payout_from: "0xd2f0a1b2c3d4e5f60718293a4b5c6d7e8f90f5c1", min_payout_usd: 50,
  rails: { coins: ["USDT"], networks: ["polygon"] },
  summary: { eligible_count: 3, eligible_total_usd: 349.2, to_fund_usd: 349.2, prepared_count: 1 },
  rows: [
    row({}),
    row({ affiliate_id: 2, code: "ESEMPIO-B", payee: { name: "L. Moretti", country: "ES" }, balance_usd: 98.2, paid_in_year_usd: 0 }),
    row({ affiliate_id: 3, code: "ESEMPIO-C", payee: { name: "G. Ferri", country: "IT" }, balance_usd: 63.4, paid_in_year_usd: 120, eligible: false, reasons: ["already_created"], payout: { id: 11, status: "created", amount_usd: 63.4 } }),
    row({ affiliate_id: 4, code: "ESEMPIO-D", payee: { name: "R. Greco", country: "FR" }, balance_usd: 38.6, paid_in_year_usd: 60 , eligible: false, reasons: ["below_threshold"] }),
    row({ affiliate_id: 5, code: "ESEMPIO-E", payee: { name: "S. Villa", country: "IT" }, balance_usd: 77, paid_in_year_usd: 0, eligible: false, reasons: ["wallet_cooldown"], wallet: { address: "0x" + "20f4a1b2c3d4e5f60718293a4b5c6d7e8f90b8d3", address_masked: "0x20f4…b8d3", coin: "USDT", network: "polygon", created_at: "2026-10-14T09:00:00Z", usable_after: "2026-10-17T14:32:00Z", screening_result: "clear" } }),
    row({ affiliate_id: 6, code: "ESEMPIO-F", payee: { name: "M. Conti", country: "IT" }, balance_usd: 0, paid_in_year_usd: 0, eligible: false, reasons: ["no_wallet", "below_threshold"], wallet: null, checks: { payee: false, screened: false, declarations: false } }),
  ],
};

export const ADMIN_PAYOUT = {
  id: 11, affiliate_id: 3, affiliate_code: "ESEMPIO-C", affiliate_status: "active", payee: { name: "G. Ferri", country: "IT" },
  period_month: "2026-10-01", amount_usd: 63.4, coin: "USDT", network: "polygon", to_address: "0x58cde39f41b702ac6d85e1f39b27c4d0e5b2a014",
  amount_coin: null, tx_hash: null, tx_nonce: null, tx_block: null, tx_from: null, explorer_url: null, status: "created", created_at: "2026-10-15T09:00:00Z", submitted_at: null, paid_at: null, cancel_code: null, cancel_reason: null,
  sent_marked_at: "2026-10-15T10:00:00Z", sent_marked_by: "bo:marco",
};
