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
// #MIS-C — `src`, `ref` e `crm` erano nelle chiavi lette dagli EVENTI
// (SEARCH_SOURCE_KEYS, piu' in basso) ma non qui: un iscritto arrivato da un
// canale Telegram (`?src=tg-free`) o da una mail del ciclo di vita
// (`?crm=wb_day7_renew`) finiva in `profiles.acquisition` senza sorgente,
// strutturalmente inattribuibile. Le due liste ora si sovrappongono e la
// cattura passa da `sourceFromSearch`: una fonte sola per le chiavi di
// provenienza, niente parsing reimplementato.
export const ATTRIBUTION_KEYS = [
  "src",
  "ref",
  "crm",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "referrer",
  "landing_path",
  "first_seen",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

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
  // Stessa funzione che legge la provenienza per gli eventi (#ATTRIB-EVERYWHERE-0915):
  // stesse chiavi, stessa ripulitura. Due parser divergono e il secondo sbaglia.
  const rec: Attribution = { ...sourceFromSearch(window.location.search) };
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

// #ATTRIB-EVERYWHERE-0915 — le chiavi di provenienza che un link puo' portare
// nella query string. `src`/`ref` sono i marcatori interni (canali Telegram,
// codici creator); gli `utm_*` sono lo standard che usano gia' i link Reddit,
// la newsletter e il widget embed; `crm` e' il tag che lib/crm-content.ts
// attacca a OGNI cta delle email del ciclo di vita.
//
// Prima di questo commit se ne leggevano DUE su sette: un click dal profilo
// Reddit (`?utm_source=reddit&utm_medium=profile&utm_campaign=algobetting`)
// finiva in un `page_view` con il solo `meta.path`, indistinguibile da uno
// arrivato per digitazione diretta. 15 iscrizioni su 21 senza sorgente.
const SEARCH_SOURCE_KEYS = [
  "src",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "crm",
] as const;

export type SearchSource = Partial<Record<(typeof SEARCH_SOURCE_KEYS)[number], string>>;

/**
 * La provenienza dichiarata nell'URL (`?src=tg-free`, `?utm_source=reddit`,
 * `?crm=wb_day7_renew`, `?ref=TG3`).
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
 * Nessun consenso richiesto: e' il dato che l'utente porta lui stesso nell'URL,
 * non un identificatore scritto sul suo terminale. Il gate del consenso resta
 * dov'era — su `initAttribution` (localStorage) e sul `session_id` del beacon.
 *
 * Valori ripuliti e tagliati: e' testo che arriva dall'URL, quindi non entra
 * grezzo nel database.
 */
export function sourceFromSearch(search: string): SearchSource {
  const out: SearchSource = {};
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || "");
  } catch {
    return out;
  }
  for (const chiave of SEARCH_SOURCE_KEYS) {
    const grezzo = params.get(chiave);
    if (!grezzo) continue;
    const pulito = grezzo.trim().slice(0, 40).replace(/[^A-Za-z0-9_.-]/g, "");
    if (pulito) out[chiave] = pulito;
  }
  return out;
}

/**
 * #ATTRIB-EVERYWHERE-0915 — il solo HOST del referrer, e solo se e' ESTERNO.
 *
 * Un link condiviso senza UTM (un thread Reddit, un post su X, un blog che ci
 * cita) non porta nulla nella query string: l'unica traccia della sua origine e'
 * l'header `Referer` che il browser manda da se'. Registrarne l'HOST dice
 * "reddit.com" senza dire QUALE pagina — minimizzazione: il percorso completo
 * direbbe cosa stava leggendo l'utente, e non ci serve per sapere che canale ha
 * funzionato.
 *
 * Nessun consenso: e' un dato che il browser trasmette a ogni richiesta, non un
 * identificatore che scriviamo sul terminale e non ricostruisce una persona.
 * Nessun fingerprinting, nessun IP.
 *
 * Il referrer INTERNO non e' una sorgente (stessa regola di `initAttribution`):
 * chi va dalla home a /tools non "arriva da betredge.com".
 */
export function externalReferrerHost(referrer?: string, selfHost?: string): string | null {
  const raw = referrer ?? (typeof document !== "undefined" ? document.referrer : "");
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return null; // referrer malformato: meglio niente che spazzatura a DB
  }
  if (!host) return null;
  const self = (selfHost ?? (typeof window !== "undefined" ? window.location.hostname : "")).toLowerCase();
  // `www.` non distingue due siti. E un sottodominio nostro (news.betredge.com,
  // checkout.betredge.com) resta nostro: non e' un canale di acquisizione.
  const apex = (h: string) => (h.startsWith("www.") ? h.slice(4) : h);
  const a = apex(host);
  const b = apex(self);
  if (b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`))) return null;
  return host.slice(0, 80);
}
