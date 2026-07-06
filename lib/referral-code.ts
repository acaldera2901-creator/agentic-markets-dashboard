// lib/referral-code.ts — #REFERRAL-SIGNUP-UX
// Cattura/lettura del codice referral in localStorage, client-only.
// - first-touch: non sovrascrive un ref valido già presente (l'attribuzione va
//   al PRIMO creator che ha portato l'utente).
// - scadenza: un ref più vecchio di 60gg viene ignorato (e ripulito) → niente
//   attribuzione "eterna" a un click vecchio mesi.
// - backward-compat: i vecchi valori in chiaro (senza timestamp) restano validi.

const KEY = "am_ref";
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 giorni
const RE = /^[A-Z0-9_-]{2,20}$/;

export function normalizeRefCode(raw: string): string | null {
  const c = (raw || "").trim().toUpperCase().slice(0, 20);
  return RE.test(c) ? c : null;
}

// Legge il codice referral valido e non scaduto (o null).
export function readRefCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    // Vecchio formato: codice in chiaro (nessun timestamp → nessuna scadenza nota).
    if (raw[0] !== "{") return normalizeRefCode(raw);
    const o = JSON.parse(raw) as { c?: string; t?: number };
    const c = normalizeRefCode(o?.c ?? "");
    if (!c) return null;
    if (typeof o.t === "number" && Date.now() - o.t > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

// Scrive il codice (first-touch): salva solo se non c'è già un ref valido.
export function writeRefCode(raw: string): void {
  if (typeof window === "undefined") return;
  const code = normalizeRefCode(raw);
  if (!code) return;
  try {
    if (readRefCode()) return; // first-touch: non sovrascrivere
    window.localStorage.setItem(KEY, JSON.stringify({ c: code, t: Date.now() }));
  } catch {
    /* storage bloccato: no-op */
  }
}
