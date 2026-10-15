// components/affiliate/status.ts — #AFFILIATE-V2-UI-1015
// Una sola mappa stato → etichetta + forma (SPEC-ui §2). Lo stato non è mai solo
// colore: tratteggio = in attesa / in preparazione; pieno royal = maturata / inviato;
// pieno grigio con ✓ = pagata / pagato; barrato rosso = stornata / annullato.
import type { AffCopy } from "./copy";
import { fill } from "./copy";
import { shortDate } from "./format";
import type { AffLang } from "./copy";

export type ChipState = "hold" | "payable" | "in_payout" | "paid" | "void" | "created" | "submitted" | "cancelled";
export type Chip = { state: ChipState; label: string; check: boolean };

export type PayoutStatus = "created" | "submitted" | "paid" | "cancelled";

export function payoutChip(status: PayoutStatus, c: AffCopy): Chip {
  const label = { created: c.pay.created, submitted: c.pay.submitted, paid: c.pay.paid, cancelled: c.pay.cancelled }[status];
  return { state: status, label, check: status === "paid" };
}

type CommissionLike = { status: string; payable_after: string | null; paid_out_at: string | null };

/** `shadow` non ha UI: il server non lo manda; se arrivasse, non si inventa un'etichetta. */
export function commissionChip(r: CommissionLike, c: AffCopy, lang: AffLang): Chip | null {
  switch (r.status) {
    case "pending":
      return { state: "hold", label: fill(c.com.hold, { date: shortDate(r.payable_after, lang) }), check: false };
    case "payable":
      return { state: "payable", label: c.com.payable, check: false };
    case "in_payout":
      return { state: "in_payout", label: c.com.in_payout, check: false };
    case "paid":
      return {
        state: "paid",
        label: r.paid_out_at ? fill(c.com.paidOn, { date: shortDate(r.paid_out_at, lang) }) : c.com.paid,
        check: true,
      };
    case "reversed":
    case "void":
      return { state: "void", label: c.com.void, check: false };
    default:
      return null;
  }
}

/** Testo (mai il motivo libero dell'admin) per un payout annullato: solo cancel_code enumerato. */
export function cancelText(code: string | null, c: AffCopy): string {
  if (code === "wallet_changed") return c.pay.cancelWalletChanged;
  if (code === "wallet_removed") return c.pay.cancelWalletRemoved;
  if (code === "tx_dropped") return c.pay.cancelTxDropped;
  return c.pay.cancelAdmin; // admin_cancelled e qualunque codice nuovo: generico, mai il testo libero
}
