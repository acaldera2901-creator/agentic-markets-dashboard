// components/affiliate/admin-copy.ts — #AFFILIATE-V2-UI-1015
// Testi del pannello admin «Payout affiliati» (solo italiano: l'admin lo è) e le
// mappe codice-backend → parole (SPEC-ui §4). Puro e testato: ogni codice che il
// server può mandare ha una frase; quello sconosciuto cade su un messaggio neutro,
// mai su un codice grezzo.

/** Motivi di esclusione di affiliate_payout_rows → parole (nessuna riga sparisce). */
export const REASON_TEXT: Record<string, string> = {
  below_threshold: "sotto soglia: passa al mese dopo",
  no_wallet: "nessun wallet registrato",
  wallet_cooldown: "wallet in attesa delle 72 ore",
  not_screened: "indirizzo non ancora controllato",
  rail_disabled: "valuta o rete non attive",
  missing_payee: "nome, paese o dichiarazioni mancanti",
  suspended: "affiliato sospeso",
  terminated: "affiliato uscito dal programma",
  already_created: "payout già preparato",
};

export function reasonText(code: string): string {
  return REASON_TEXT[code] ?? "non pagabile ora";
}

/** Esito `rejected{reason}` di /tx e /verify: il payout resta com'era, un hash sbagliato non si registra. */
export const TX_REJECT_TEXT: Record<string, string> = {
  invalid_format: "Formato non valido: l'hash è 0x seguito da 64 caratteri esadecimali.",
  not_found: "Hash non trovato sulla rete.",
  tx_failed: "La transazione è fallita sulla rete.",
  wrong_token: "Il token non è l'USDT atteso.",
  wrong_recipient: "Il destinatario è diverso dall'indirizzo del payout.",
  wrong_sender: "Il mittente non è il wallet di uscita.",
  amount_too_low: "L'importo è troppo basso (meno del 99% del dovuto).",
  network_not_supported: "Rete non supportata dal verificatore.",
};

/** Errori {error} delle rotte tx / verify / cancel (HTTP non-2xx senza `outcome`). */
export const TX_ERROR_TEXT: Record<string, string> = {
  hash_already_used: "Questo hash è già stato usato per questo destinatario.",
  hash_mismatch: "Il payout ha già un altro hash registrato.",
  already_paid: "Il payout è già pagato con un altro hash.",
  cancelled: "Il payout è annullato: se i fondi sono già partiti va gestito a mano.",
  not_found: "Payout non trovato.",
  not_submitted: "Si può riverificare solo un payout inviato.",
  not_cancellable: "Si annulla solo un payout in preparazione, senza hash.",
  reason_required: "Il motivo è obbligatorio (da 3 a 500 caratteri).",
  verifier_unavailable: "Il verificatore non risponde. Il payout non è cambiato: riprova.",
  payouts_off: "I payout non sono attivi (AFFILIATE_PAYOUTS=off): non si registra niente.",
  payout_from_not_configured: "Il wallet di uscita non è configurato.",
  record_failed: "Non sono riuscito a registrare. Il payout non è cambiato: riprova.",
  "cross-site request blocked": "Richiesta bloccata (cross-site).",
  Unauthorized: "Sessione admin scaduta: accedi di nuovo.",
};

export function txErrorText(code: unknown): string {
  return (typeof code === "string" && TX_ERROR_TEXT[code]) || "Operazione non riuscita. Il payout non è cambiato: riprova.";
}

/** Errori di POST /payouts (crea). `total_mismatch` ha un testo suo con la differenza. */
export const CREATE_ERROR_TEXT: Record<string, string> = {
  payouts_off: "I payout non sono attivi (AFFILIATE_PAYOUTS=off): non si crea niente.",
  payout_from_not_configured: "Il wallet di uscita non è configurato: non si crea niente.",
  period_not_current: "Si crea solo per il mese corrente. Non è stato creato niente.",
  invalid_ids: "Selezione non valida.",
  invalid_expected_total: "Totale non valido.",
  no_ids: "Nessun affiliato selezionato.",
  unknown_affiliate: "Un affiliato selezionato non esiste più. Non è stato creato niente: rileggi l'elenco.",
  not_eligible: "Alcuni affiliati non sono più pagabili. Non è stato creato niente: rileggi l'elenco.",
  "create failed": "Non sono riuscito a creare. Non è stato creato niente: riprova.",
};

/** `total_mismatch`: mostra la differenza, non crea (SPEC §4.1). `fmt` formatta i dollari. */
export function createErrorText(data: { error?: unknown; expected?: unknown; actual?: unknown } | null, fmt: (n: number) => string): string {
  const code = typeof data?.error === "string" ? data.error : "";
  if (code === "total_mismatch") {
    const exp = Number(data?.expected);
    const act = Number(data?.actual);
    if (Number.isFinite(exp) && Number.isFinite(act)) {
      const diff = Math.round((act - exp) * 100) / 100;
      return `Il totale è cambiato mentre decidevi: atteso ${fmt(exp)}, ora ${fmt(act)} (${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}). Non è stato creato niente: ricontrolla l'elenco aggiornato e riprova.`;
    }
    return "Il totale è cambiato mentre decidevi. Non è stato creato niente: ricontrolla l'elenco aggiornato.";
  }
  return CREATE_ERROR_TEXT[code] ?? "Non è stato creato niente: riprova.";
}

/** Mese precedente di "YYYY-MM". */
export function prevMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 2, 1));
  return d.toISOString().slice(0, 7);
}

export function nextMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  return d.toISOString().slice(0, 7);
}
