// lib/affiliate/payee.ts — #AFFILIATE-V2-CRYPTO-1007 PR-5
// Validazione dei dati del beneficiario (D3: KYC minimo al wallet). Pura.
// Fuori dalla rotta perché un route.ts di Next esporta solo handler e config.

/** Nome legale: 2–200 caratteri dopo il trim (CHECK payee_legal_name), niente caratteri di controllo. */
export function cleanLegalName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (s.length < 2 || s.length > 200) return null;
  if (/[\u0000-\u001f\u007f]/.test(s)) return null;
  return s;
}

// Codici che Intl risolve ma non sono paesi: ZZ «Unknown Region», EU/EZ/UN/QO
// aggregati, AA/QM–QZ/XA–XZ riservati all'uso privato (XK = Kosovo resta).
const NOT_A_COUNTRY = /^(ZZ|EU|EZ|UN|QO|AA|Q[M-Z]|X[A-JL-Z])$/;

/** ISO-3166 alpha-2 di un paese esistente (non solo due lettere qualsiasi). */
export function cleanCountry(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || NOT_A_COUNTRY.test(c)) return null;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(c);
    return name && name !== c ? c : null;
  } catch {
    return null;
  }
}
