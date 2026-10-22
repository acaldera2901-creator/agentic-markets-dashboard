// components/affiliate/types.ts — #AFFILIATE-V2-UI-1015
// Tipi delle risposte API: importati (solo tipi, cancellati al build) dai moduli
// server che le producono, così il contratto non può divergere in silenzio.
import type { CommissionView, LedgerView, PayoutView, TierView, WalletView } from "@/lib/affiliate/account";
import type { AdminPayout, AdminPayoutRow } from "@/lib/affiliate/payouts";
import type { PayoutCoin, PayoutNetwork } from "@/lib/affiliate/wallet";

export type { CommissionView, LedgerView, PayoutView, TierView, WalletView, AdminPayout, AdminPayoutRow };

export type Payee = {
  name: string | null;
  country: string | null;
  declarations: { sanctions_at: string | null; tax_at: string | null };
};

/** Flag operativi esposti da /api/affiliate/me (route.ts): il pannello li legge, non li inventa.
 *  Assenti nelle risposte precedenti al rollout → «ignoto», nessun banner. */
export type Operations = { payouts_enabled: boolean; accounting_ready: boolean };

/** GET /api/affiliate/me — non iscritto: 200 {enrolled:false, open}. */
export type MeResponse =
  | { enrolled: false; open: boolean; operations?: Operations }
  | {
      enrolled: true;
      operations?: Operations;
      affiliate: { code: string; status: "active" | "suspended" | "terminated"; terms_version: string; created_at: string };
      ledger: LedgerView;
      /** #AFFILIATE-TIERS-1021 — assente nelle risposte precedenti al rollout: il pannello lo tratta come «non disponibile». */
      tier?: TierView;
      wallet: WalletView;
      payee: Payee;
      rails: { coins: PayoutCoin[]; networks: PayoutNetwork[] };
      payouts: PayoutView[];
      commissions: { items: CommissionView[]; next_cursor: number | null };
    };

/** GET /api/affiliate/join */
export type JoinInfo = {
  open: boolean;
  enrolled: boolean;
  status: string | null;
  terms_version: string | null;
  code: string | null;
  code_locked: boolean;
};

/** GET /api/admin/affiliate/payouts */
export type AdminMonth = {
  month: string;
  current_month: string;
  /** `off` = i payout non sono attivi (AFFILIATE_PAYOUTS): si vede, non si nasconde. */
  mode: "off" | "live";
  payout_from: string | null;
  min_payout_usd: number;
  rails: { coins: string[]; networks: string[] };
  summary: { eligible_count: number; eligible_total_usd: number; to_fund_usd: number; prepared_count: number };
  rows: AdminPayoutRow[];
};

export type TxOutcome =
  | { outcome: "paid"; payout_id: number; confirmations?: number; amount_coin?: string; explorer_url?: string; already?: boolean; overpaid?: boolean; tx_from_mismatch?: boolean }
  | { outcome: "submitted"; payout_id: number; confirmations: number; required?: number; amount_coin?: string; explorer_url?: string; overpaid?: boolean; tx_from_mismatch?: boolean }
  | { outcome: "rejected"; reason: string };
