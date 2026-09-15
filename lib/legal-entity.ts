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
//     UNICA ECCEZIONE, dal 2026-09-15: `/privacy` §1 nomina il titolare del
//     trattamento — `PRIVACY_CONTROLLER`, in fondo a questo file. Footer del
//     sito, footer email, `/terms` §14 e `/widget` restano come sono.
//
// ⚠️ UNA DELLE DUE CLAUSOLE È STATA SISTEMATA IL 2026-09-15, L'ALTRA NO:
//  a) `/privacy` §1 — CHIUSA. #PRIVACY-CONTROLLER-0915: Andrea ha dichiarato il
//     titolare del trattamento (vedi `PRIVACY_CONTROLLER` più sotto). Vale SOLO
//     per quella sezione, non per footer/email/terms.
//  b) `/terms` §14 — APERTA. La scelta "legge svizzera, foro di Zugo" era legata
//     alla società svizzera. Il nome è stato rimosso, la scelta di legge NO — non
//     è una decisione tecnica. Oggi la clausola indica un foro svizzero senza
//     nominare un'entità svizzera: da riconciliare. La decisione del 15/09 NON la
//     tocca (Andrea, esplicitamente: `/terms` resta come sta), quindi il foro
//     orfano resta un residuo aperto.
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

/**
 * #PRIVACY-CONTROLLER-0915 — il TITOLARE del trattamento, e nient'altro.
 *
 * Perché esiste una costante separata invece di cambiare `LEGAL_ENTITY` o
 * `impressumLine()`: quelli alimentano footer del sito, footer delle email,
 * `/terms` §14 e `/widget`, e lì la società operativa NON deve comparire —
 * #SITE-ENTITY-0824 (Andrea) e #EMAIL-SENDER-IDENTITY-0824 (Jo) restano in
 * vigore, invariati. Se un giorno qualcuno prova a usare questa costante per il
 * footer, i test di `legal-entity.test.ts` diventano rossi prima del deploy.
 *
 * Decisione di Andrea del 2026-09-15, esplicita e circoscritta: l'entità torna
 * visibile SOLO su `/privacy` §1, perché l'art. 13(1)(a) GDPR pretende
 * l'identità del titolare e "marchio + casella di corrispondenza" non è una
 * persona giuridica. Dato completo, non il nome nudo.
 *
 * Dati verificati sul Registro di commercio di Zugo via Zefix il 2026-09-15:
 * stato EXISTIEREND, sede legale Baar, CHID CH-440-3038156-7. (Erano già stati
 * verificati il 2026-07-13, commit a6329933, con lo stesso esito.)
 */
export const PRIVACY_CONTROLLER = {
  /** Denominazione completa, come a registro. */
  name: "Maven Agency AG",
  /** Sede legale (legalSeat Zefix: Baar, canton Zugo). */
  address: "Blegistrasse 7, 6340 Baar (ZG), Switzerland",
  /** Numero d'identificazione delle imprese svizzero. */
  uid: "CHE-193.960.193",
} as const;
