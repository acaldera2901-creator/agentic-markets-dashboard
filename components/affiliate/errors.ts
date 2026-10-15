// components/affiliate/errors.ts — #AFFILIATE-V2-UI-1015
// Mappa errori del wallet: {error, field} del backend → messaggio + campo (SPEC-ui §3.3).
// Il server è l'arbitro; il client usa la stessa tabella per l'anteprima locale.
import type { AffCopy } from "./copy";

export type WalletFieldId = "name" | "country" | "addr" | "last6" | "netack" | "sanc" | "tax";
export type WalletErrKey = keyof AffCopy["walletErr"];

export type WalletError = { key: WalletErrKey; field: WalletFieldId | null };

/** Campo del backend → id di campo del form. */
const FIELD: Record<string, WalletFieldId> = {
  address: "addr",
  last6: "last6",
  payee_legal_name: "name",
  payee_country: "country",
  network_ack: "netack",
  "declarations.sanctions": "sanc",
  "declarations.tax": "tax",
};

/** Codice backend → chiave di copy. Quello che non c'è qui cade su `network` (riprova). */
const CODE: Record<string, WalletErrKey> = {
  invalid_format: "invalid_format",
  invalid_checksum: "invalid_checksum",
  zero_address: "zero_address",
  last6_mismatch: "last6_mismatch",
  address_blocked: "address_blocked",
  address_not_allowed: "address_not_allowed",
  coin_not_enabled: "rail_not_enabled",
  network_not_enabled: "rail_not_enabled",
  unsupported_coin: "rail_not_enabled",
  unsupported_network: "rail_not_enabled",
  unsupported_pair: "rail_not_enabled",
  network_ack_required: "network_ack_required",
  invalid_legal_name: "invalid_legal_name",
  invalid_country: "invalid_country",
  declaration_required: "declaration_required",
  suspended: "suspended",
  terminated: "terminated",
  program_closed: "program_closed",
};

/**
 * `error` e `field` come li manda PUT /api/affiliate/wallet. Gli errori senza
 * campo e i guasti (screening_unavailable, save_failed, too_many_requests, 5xx,
 * rete) restano un messaggio di form: «non è cambiato niente, riprova».
 */
export function mapWalletError(error: unknown, field?: unknown): WalletError {
  const code = typeof error === "string" ? error : "";
  let key: WalletErrKey = CODE[code] ?? "network";
  const f = typeof field === "string" ? FIELD[field] ?? null : null;
  if (code === "declaration_required") {
    if (field === "declarations.sanctions") key = "declaration_sanctions";
    else if (field === "declarations.tax") key = "declaration_tax";
  }
  return { key, field: f };
}

/** Indirizzo Tron incollato per sbaglio: euristica SOLO client (T + 34 caratteri). */
export function looksLikeTron(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim());
}

/** Controllo locale dell'indirizzo, prima di Continua. Il checksum EIP-55 lo decide il server. */
export function checkAddressLocal(address: string): WalletErrKey | null {
  const a = address.trim();
  if (looksLikeTron(a)) return "tron_address";
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return "invalid_format";
  if (a.toLowerCase() === "0x0000000000000000000000000000000000000000") return "zero_address";
  return null;
}

/** Ultime 6 cifre, confronto case-insensitive. */
export function last6Matches(address: string, last6: string): boolean {
  const l = last6.trim().toLowerCase();
  return l.length === 6 && address.trim().toLowerCase().endsWith(l);
}
