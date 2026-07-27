// lib/legal-entity.ts
// Unica fonte di verità sull'entità che opera BetRedge, per l'impressum legale.
// Esisteva già identica in tre posti (app/terms, app/privacy, components/SiteFooter)
// e una QUARTA volta come env sul footer email — che era stata settata a un valore
// diverso ("Betredge" + l'indirizzo di corrispondenza di Londra), producendo due
// entità dichiarate diverse nello stesso prodotto. Da qui in avanti l'entità sta
// scritta in un posto solo.
//
// Ponte Maven interim in attesa della SL spagnola (decisione Andrea, memo
// legale-societario 2026-07-13). Registro verificato: CHE-193.960.193, EXISTIEREND.
//
// NB Londra (Hoxton Mix) è un indirizzo di CORRISPONDENZA, non una sede legale, e
// non esiste nessuna società registrata "Betredge" (Companies House, verificato
// 2026-07-27). Non va mai usato come identità del mittente.

export const LEGAL_ENTITY = {
  /** Nome commerciale del prodotto. */
  brand: "BetRedge",
  /** Ragione sociale registrata dell'operatore. */
  legalName: "Maven Agency AG",
  /** Sede legale. */
  address: "Blegistrasse 7, 6340 Baar (ZG), Switzerland",
  /** Identificativo di registro, etichetta inclusa (entità svizzera: UID, non P.IVA). */
  taxId: "UID CHE-193.960.193",
  /** Indirizzo di corrispondenza — mai spacciato per sede legale. */
  correspondence: "BetRedge, 66 Paul Street, London EC2A 4NA, United Kingdom",
} as const;

/**
 * Riga di impressum per il footer delle email, nella stessa forma già live sul
 * sito ("BetRedge · operated by Maven Agency AG · …"): stessa entità, stesse
 * parole, così le due superfici non possono più divergere.
 */
export function impressumLine(): string {
  const { brand, legalName, address, taxId } = LEGAL_ENTITY;
  return `${brand} · operated by ${legalName} · ${address} · ${taxId}`;
}
