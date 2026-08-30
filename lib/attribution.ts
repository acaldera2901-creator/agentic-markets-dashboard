// lib/attribution.ts — #FUNNEL-MEAS-0813
// Attribuzione di acquisizione first-touch, SOLO dato di prima parte in
// localStorage (nessun cookie, nessun vendor, nessun nuovo perimetro di
// consenso). Scritta al primo caricamento e mai sovrascritta: la sorgente
// che conta è quella che ha portato l'utente la PRIMA volta, non l'ultima
// (stessa regola di lib/referral-code.ts, chiave diversa).

import { storageGet, storageSet } from "@/lib/safe-storage";

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
  // #STORAGE-CRASH-0813: si passa da lib/safe-storage, non da window.localStorage
  // nudo. Dove lo storage è vietato (Safari privato, browser interni delle app,
  // cookie bloccati) `getItem` LANCIA, e questa funzione gira in un useEffect del
  // root layout: un throw qui porterebbe OGNI rotta nel boundary globale.
  // storageGet/storageSet non lanciano mai — niente try/catch che li riavvolga.
  if (storageGet("gdpr_consent") !== "accepted") return;
  if (storageGet(KEY)) return; // first-touch: mai sovrascrivere
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
  // Storage vietato: storageSet torna false e l'attribuzione semplicemente non
  // viene catturata. Una sorgente persa è un inconveniente, una pagina che non
  // carica è un cliente perso.
  storageSet(KEY, JSON.stringify(rec));
}

// Client-only. Null se assente o illeggibile — l'assenza non deve mai rompere il signup.
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  // #STORAGE-CRASH-0813: la lettura passa da safe-storage (torna null se lo
  // storage è vietato). Il try/catch che resta NON è ridondante: copre solo
  // JSON.parse, che lancia davvero su un record corrotto o manomesso.
  const raw = storageGet(KEY);
  if (!raw) return null;
  try {
    return sanitizeAttribution(JSON.parse(raw) as unknown);
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

/**
 * La provenienza dichiarata nell'URL (`?src=tg-free`, `?ref=TG3`).
 *
 * I link dei canali Telegram portano `src=` da agosto, ma NESSUNO lo registrava
 * all'arrivo: `page_view` salvava solo `meta.path`. Misurato il 30/08: zero
 * righe attribuibili a Telegram in 30 giorni, non perche' non arrivasse nessuno
 * ma perche' non stavamo guardando.
 *
 * Si legge da `window.location.search` e non da `useSearchParams()`: quel hook
 * rende DINAMICA la pagina che lo monta, e la home e le 132 pagine dei tool sono
 * statiche per SEO. Qui siamo dentro un effetto, quindi client-only e senza
 * conseguenze sul rendering.
 *
 * Valori ripuliti e tagliati: e' testo che arriva dall'URL, quindi non entra
 * grezzo nel database.
 */
export function sourceFromSearch(search: string): { src?: string; ref?: string } {
  const out: { src?: string; ref?: string } = {};
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || "");
  } catch {
    return out;
  }
  for (const chiave of ["src", "ref"] as const) {
    const grezzo = params.get(chiave);
    if (!grezzo) continue;
    const pulito = grezzo.trim().slice(0, 40).replace(/[^A-Za-z0-9_.-]/g, "");
    if (pulito) out[chiave] = pulito;
  }
  return out;
}
