// #FUNNEL-INTENT-0908 — l'intento d'acquisto che sopravvive al gate email.
//
// Il gate di attivazione via email è ACCESO in produzione (misurato sul DB
// l'08/09: su 14 profili in 20 giorni `activated_at` arriva 9-64 secondi DOPO
// `created_at`, mai nello stesso istante). Quindi chi sceglie un piano da
// anonimo NON ottiene una sessione al signup: riceve un'email, la apre — spesso
// dal telefono, quindi in un altro browser — e atterra in una navigazione nuova.
// Nessuno stato client sopravvive a quel salto: `sessionStorage` muore col tab e
// `localStorage` è dietro il consenso GDPR.
//
// Quindi l'intento viaggia nel LINK, non nel browser. È noto al server nel
// momento in cui il link di attivazione viene generato, e torna indietro col
// redirect finale.
//
// Il valore arriva da fuori (query string di una GET pubblica): è input non
// fidato a un trust boundary. Si valida con un'allowlist chiusa, e la
// destinazione del redirect si LEGGE da una tabella — non si costruisce mai
// interpolando la stringa ricevuta.

export type SignupIntent = "plans:base" | "plans:premium" | "plans:weekly" | "free";

// Dove atterra chi ha attivato, per ogni intento. Chiavi = l'allowlist: un
// valore che non è una chiave di questa tabella non esiste per il resto del
// codice. I valori sono letterali, mai concatenazioni di input.
const ACTIVATION_LANDING: Record<SignupIntent, string> = {
  "plans:base": "plans?activated=1&goto=plans:base",
  "plans:premium": "plans?activated=1&goto=plans:premium",
  "plans:weekly": "weekly-pick?activated=1",
  free: "predictions?activated=1",
};

// Dove atterra chi si è registrato SENZA intento d'acquisto. È il comportamento
// che esiste oggi e non deve cambiare: chi arriva da una mail fredda per le
// predizioni non deve ritrovarsi sul listino.
export const ACTIVATION_LANDING_DEFAULT = "?activated=1";

/** Allowlist chiusa. Qualunque altro valore — inclusi undefined, oggetti, path
 *  traversal, URL assoluti, varianti di maiuscole — diventa `null`. */
export function normalizeSignupIntent(value: unknown): SignupIntent | null {
  return typeof value === "string" && Object.hasOwn(ACTIVATION_LANDING, value)
    ? (value as SignupIntent)
    : null;
}

/** Il suffisso del redirect di attivazione. Restituisce sempre un letterale
 *  scritto qui dentro: la stringa ricevuta dal client non ci finisce mai. */
export function activationLanding(value: unknown): string {
  const intent = normalizeSignupIntent(value);
  return intent ? ACTIVATION_LANDING[intent] : ACTIVATION_LANDING_DEFAULT;
}

/** Il pezzo di query string da appendere al link di attivazione nell'email.
 *  Vuoto se non c'è un intento valido, così il link resta identico a oggi. */
export function activationLinkParam(value: unknown): string {
  const intent = normalizeSignupIntent(value);
  return intent ? `&goto=${intent}` : "";
}
