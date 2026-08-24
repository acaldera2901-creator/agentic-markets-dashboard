// lib/legal-entity.ts
// Unica fonte di verità sull'entità che opera BetRedge, per l'impressum legale.
// Esisteva già identica in tre posti (app/terms, app/privacy, components/SiteFooter)
// e una QUARTA volta come env sul footer email — che era stata settata a un valore
// diverso ("Betredge" + l'indirizzo di corrispondenza di Londra), producendo due
// entità dichiarate diverse nello stesso prodotto. Da qui in avanti l'entità sta
// scritta in un posto solo.
//
// #EMAIL-SENDER-IDENTITY-0824 — richiesta di Jo, confermata da Andrea: la società
// operativa non deve comparire nei footer delle email. L'identità del mittente
// diventa il marchio più l'indirizzo di corrispondenza di Londra.
//
// ⚠️ TRE COSE DA SAPERE, tutte verificate, perché questa scelta ha una storia:
//  1. È la stessa forma già stata in produzione e RIMOSSA di proposito dalla
//     PR #221 ("una sola entità dichiarata"): allora le env dichiaravano questa
//     riga mentre il sito dichiarava la società svizzera, cioè due entità diverse
//     nello stesso prodotto. Vedi `git log` di questo file per il ripristino.
//  2. A Companies House NON risulta nessuna società registrata "Betredge"
//     (verificato 2026-07-27). 66 Paul Street è una casella Hoxton Mix, cioè un
//     indirizzo di CORRISPONDENZA, non una sede legale.
//  3. `/terms`, `/privacy` e `components/SiteFooter.tsx` continuano a dichiarare
//     la società svizzera (hardcoded, NON leggono questo modulo — verificato live
//     il 2026-08-24). Finché restano così, email e sito dichiarano identità
//     diverse: è il problema che la #221 aveva chiuso, riaperto per decisione.
//
// La riga resta in un posto solo così quando l'entità sarà decisa (SL spagnola o
// registrazione UK) si cambia qui e propaga a tutte le email in un colpo.

export const LEGAL_ENTITY = {
  /** Nome commerciale del prodotto. */
  brand: "BetRedge",
  /** Identità dichiarata nei footer email (#EMAIL-SENDER-IDENTITY-0824). */
  senderName: "Betredge",
  /** Indirizzo di corrispondenza — NON una sede legale. */
  correspondence: "66 Paul Street, London EC2A 4NA",
} as const;

/**
 * Riga di identità per il footer delle email. Unica per tutte le email che ne
 * mostrano una — CRM lifecycle e transazionali — così non possono divergere fra
 * loro. NB: il sito ha la sua, hardcoded in tre file (vedi nota in testa).
 */
export function impressumLine(): string {
  const { senderName, correspondence } = LEGAL_ENTITY;
  return `${senderName} · ${correspondence}`;
}
