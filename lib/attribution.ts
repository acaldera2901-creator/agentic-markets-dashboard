// lib/attribution.ts — #FUNNEL-MEAS-0813
// Attribuzione di acquisizione first-touch, SOLO dato di prima parte in
// localStorage (nessun cookie, nessun vendor, nessun nuovo perimetro di
// consenso). Scritta al primo caricamento e mai sovrascritta: la sorgente
// che conta è quella che ha portato l'utente la PRIMA volta, non l'ultima
// (stessa regola di lib/referral-code.ts, chiave diversa).

const KEY = "am_attrib";
const MAX_VALUE_LEN = 200;
const MAX_PAYLOAD_BYTES = 2048;

// Chiavi note: sono anche l'allowlist usata dalla sanificazione server-side.
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "referrer",
  "landing_path",
  "first_seen",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

// Client-only. Idempotente: se un record esiste già non tocca nulla.
// Nessuna scrittura prima del consenso: stessa regola di lib/track-event
// (#GOLIVE-QW-A), che manda il session_id solo con gdpr_consent === "accepted".
// Senza consenso — o dopo un Decline esplicito — è un no-op. Se il consenso
// arriva dopo, il chiamante ri-invoca: l'utente è ancora sulla stessa pagina,
// quindi query string e referrer sono ancora leggibili.
export function initAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("gdpr_consent") !== "accepted") return;
    if (window.localStorage.getItem(KEY)) return; // first-touch: mai sovrascrivere
    const q = new URLSearchParams(window.location.search);
    const rec: Attribution = {};
    for (const k of UTM_KEYS) {
      const v = q.get(k);
      if (v) rec[k] = v.slice(0, MAX_VALUE_LEN);
    }
    // Il referrer interno non è una sorgente di acquisizione: se l'utente arriva
    // dalla home a /tools, la sorgente resta quella con cui è entrato in home.
    const ref = typeof document !== "undefined" ? document.referrer : "";
    if (ref && !ref.startsWith(window.location.origin)) rec.referrer = ref.slice(0, MAX_VALUE_LEN);
    rec.landing_path = window.location.pathname.slice(0, MAX_VALUE_LEN);
    rec.first_seen = new Date().toISOString();
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage bloccato (private mode / policy): no-op, il signup funziona lo stesso */
  }
}

// Client-only. Null se assente o illeggibile — l'assenza non deve mai rompere il signup.
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeAttribution(parsed);
  } catch {
    return null;
  }
}

// Sanificazione condivisa client/server: solo chiavi note, solo stringhe, ogni
// valore troncato, l'intero oggetto scartato se supera il cap di payload.
// Usata dal server (POST /api/auth) prima di scrivere profiles.acquisition:
// il body è controllato dal client, quindi è un trust boundary.
export function sanitizeAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const out: Attribution = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = src[k];
    if (typeof v === "string" && v.length) out[k] = v.slice(0, MAX_VALUE_LEN);
  }
  if (!Object.keys(out).length) return null;
  const json = JSON.stringify(out);
  if (json.length > MAX_PAYLOAD_BYTES) return null;
  return out;
}

// Comodo per il ramo register: la stringa JSON pronta per la colonna JSONB (o null).
export function acquisitionJson(input: unknown): string | null {
  const clean = sanitizeAttribution(input);
  return clean ? JSON.stringify(clean) : null;
}
