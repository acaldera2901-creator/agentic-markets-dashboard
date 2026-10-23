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
  wrong_token: "Il token non è quello del payout (USDT o USDC su Polygon, come indicato al passo 1).",
  wrong_recipient: "Il destinatario è diverso dall'indirizzo del payout.",
  wrong_sender: "Il mittente non è il wallet di uscita.",
  amount_too_low: "L'importo è inferiore al dovuto (anche di 0,01): serve l'importo ESATTO.",
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
  not_cancellable: "Questo payout non si può annullare in questo stato.",
  reason_required: "Il motivo è obbligatorio (da 3 a 500 caratteri).",
  verifier_unavailable: "Il verificatore on-chain non risponde: non so se la transazione esiste (non è «hash non trovato»). Il payout non è cambiato: riprova più tardi.",
  tx_on_chain: "La transazione risulta ancora valida sulla rete: il payout non si annulla e resta com'è. Usa «Riverifica» finché non è Pagato.",
  tx_not_droppable: "Il server non può annullare questo payout adesso: la transazione potrebbe ancora essere minata. Il payout resta com'è.",
  block_unknown: "Per questo payout non è registrato il blocco dell'invio: il server non può verificare che la transazione sia sparita, quindi non annulla. Il payout resta com'è; se serve, gestiscilo a mano.",
  from_unknown: "Il mittente della tx non è registrato: il server non annulla, gestiscilo a mano. Il payout resta com'è.",
  nonce_unknown: "Per questo payout non è registrato il nonce dell'invio: il server non può verificare che la transazione sia davvero sparita, quindi non annulla. Il payout resta com'è; se serve, gestiscilo a mano.",
  too_recent: "Sono passati meno di 30 minuti dalla registrazione dell'hash: riprova dopo.",
  affiliate_not_active: "L'affiliato non è attivo: non si registra niente. Se i fondi sono già partiti, gestiscili a mano.",
  not_marked: "Il payout non è stato approvato e marcato «in uscita» da un secondo operatore nominato (backoffice): non si registra niente. Non inviare fondi prima della marca.",
  "origin not allowed": "Richiesta bloccata (origine non ammessa). Ricarica la pagina admin.",
  payouts_off: "I payout non sono attivi (AFFILIATE_PAYOUTS=off): non si registra niente.",
  payout_from_not_configured: "Il wallet di uscita non è configurato.",
  record_failed: "Non sono riuscito a registrare. Il payout non è cambiato: riprova.",
  "cross-site request blocked": "Richiesta bloccata (cross-site).",
  Unauthorized: "Sessione admin scaduta: accedi di nuovo.",
};

/** Motivi di `tx_not_droppable` (POST cancel su un payout `submitted`). Mai un invito a «pagare di nuovo». */
export const NOT_DROPPABLE_TEXT: Record<string, string> = {
  tx_on_chain: "La transazione risulta ancora valida sulla rete: il payout non si annulla e resta com'è.",
  tx_pending: "La transazione è ancora in attesa sulla rete e potrebbe essere minata: il payout non si annulla e resta com'è. Riverifica più tardi.",
  nonce_not_consumed: "Per annullare devi prima sostituire la tx bloccata dal wallet di uscita (stesso nonce) e aspettare che sia finalizzata. Il payout resta com'è.",
  transfer_found: "La tx risulta sulla rete: non si annulla. Il payout resta com'è.",
  not_finalized: "Il blocco della transazione (o quello della registrazione) non è ancora finalizzato: aspetta la finalizzazione e riprova. Il payout resta com'è.",
};

/** Errore di tx / verify / cancel: gestisce anche reason (tx_not_droppable) e dropped (hash_already_used). */
export function txFailText(data: { error?: unknown; reason?: unknown; dropped?: unknown } | null): string {
  if (data?.error === "tx_not_droppable" && typeof data.reason === "string" && NOT_DROPPABLE_TEXT[data.reason]) return NOT_DROPPABLE_TEXT[data.reason];
  if (data?.error === "hash_already_used" && data.dropped === true) return "Questo hash appartiene a un pagamento annullato perché la transazione era sparita: non si può registrare di nuovo.";
  return txErrorText(data?.error);
}

export function txErrorText(code: unknown): string {
  return (typeof code === "string" && TX_ERROR_TEXT[code]) || "Operazione non riuscita. Il payout non è cambiato: riprova.";
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
