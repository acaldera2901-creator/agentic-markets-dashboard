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
//  3. #SITE-ENTITY-0824 — richiesta di Andrea: la società operativa non deve
//     comparire NEMMENO sul sito. `components/SiteFooter.tsx`, `/privacy` §1 e
//     `/terms` §14 ora LEGGONO questo modulo invece di avere l'entità hardcoded,
//     così sito ed email non possono più divergere (era il difetto della #221).
//
// ⚠️ DUE CLAUSOLE RESTANO DA SISTEMARE CON L'AVVOCATO — vedi i commenti nei due
// file. Sono cose che il codice non può decidere:
//  a) `/privacy` §1: GDPR art. 13 richiede l'identità del TITOLARE del
//     trattamento. Qui ora c'è marchio + indirizzo di corrispondenza, senza forma
//     societaria né numero di registro: niente di falso è asserito, ma nessuna
//     persona giuridica è nominata.
//  b) `/terms` §14: la scelta "legge svizzera, foro di Zugo" era legata alla
//     società svizzera. Il nome è stato rimosso, la scelta di legge NO — non è
//     una decisione tecnica. Oggi la clausola indica un foro svizzero senza
//     nominare un'entità svizzera: da riconciliare.
//
// La riga resta in un posto solo così quando l'entità sarà decisa (SL spagnola o
// registrazione UK) si cambia qui e propaga a sito ed email in un colpo.

export const LEGAL_ENTITY = {
  /** Nome commerciale del prodotto. */
  brand: "BetRedge",
  /** Identità dichiarata nei footer (#EMAIL-SENDER-IDENTITY-0824). */
  senderName: "Betredge",
  /** Indirizzo di corrispondenza — NON una sede legale. */
  correspondence: "66 Paul Street, London EC2A 4NA",
  /** Contatto pubblico, unico per sito ed email. */
  contactEmail: "info@betredge.com",
} as const;

/**
 * Riga di identità, usata da TUTTE le superfici che ne mostrano una: footer email
 * (CRM lifecycle + transazionali), footer del sito, `/privacy` §1 e `/terms` §14.
 * Un posto solo, così non possono più divergere.
 */
export function impressumLine(): string {
  const { senderName, correspondence } = LEGAL_ENTITY;
  return `${senderName} · ${correspondence}`;
}
