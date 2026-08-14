// lib/signup-geo.ts — gate geo al SIGNUP (#SIGNUP-GEO-0814, D2 di
// #LAUNCHDEC-0814). Decisione Andrea 14/08: GO sul meccanismo, allowlist in
// ENV così aprire un paese non richiede un deploy; "chiuso di default" per
// ogni paese fuori lista; denial loggati con country. Allowlist iniziale
// decisa da Andrea: CH, UK, NO, SE, IT — con GATE LEGALE a verbale nella REQ
// per IT/SE (UE: Art.27/consenso) e NO prima di attivarla in prod.
//
// Semantica della env SIGNUP_COUNTRY_ALLOWLIST:
// - ASSENTE o vuota  -> gate INATTIVO: signup aperto nel mondo (comportamento
//   attuale, invariato). Il merge di questo codice non cambia nulla finché la
//   env non viene settata: rispetta il vincolo "non attivarlo con una lista
//   che blocchi i paganti attuali" (calde, msg_msstwwf8).
// - "*"              -> gate attivo ma tutto ammesso (kill-switch reversibile
//   senza svuotare la env; stesso idioma di SPORTSBOOK_GEO_ALLOWLIST).
// - CSV di paesi     -> SOLO quei paesi possono registrarsi. Confronto su
//   ISO 3166-1 alpha-2 (l'header x-vercel-ip-country); "UK" viene normalizzato
//   a "GB" perché il codice ISO del Regno Unito è GB e una lista scritta a
//   mano con "UK" bloccherebbe silenziosamente tutto il traffico britannico.
//
// A gate ATTIVO, country ASSENTE = negato (default-chiuso coerente): su Vercel
// l'header è sempre presente ed è impostato dalla piattaforma (non spoofabile
// dal client); un request senza header non arriva dalla produzione.
// NB: questo gate copre il solo action=register. Login, logout e recupero
// password restano aperti: un utente esistente non perde mai l'accesso.

// UK -> GB: unica normalizzazione ammessa (alias d'uso comune, non ISO).
function normalizeCountry(c: string): string {
  const up = c.trim().toUpperCase();
  return up === "UK" ? "GB" : up;
}

function allowlistRaw(): string {
  return (process.env.SIGNUP_COUNTRY_ALLOWLIST || "").trim();
}

// Il gate esiste solo se la env è settata.
export function signupGeoActive(): boolean {
  return allowlistRaw().length > 0;
}

export function signupCountryAllowed(country: string | null | undefined): boolean {
  const raw = allowlistRaw();
  if (!raw) return true; // gate inattivo: mondo aperto (stato attuale)
  if (raw === "*") return true;
  if (!country) return false; // gate attivo + paese ignoto: default-chiuso
  const allow = new Set(raw.split(",").map(normalizeCountry).filter(Boolean));
  return allow.has(normalizeCountry(country));
}

// Paese della request: header geo di Vercel, fallback Cloudflare (stesso
// ordine di /api/track).
export function resolveRequestCountry(req: Request): string | null {
  return (
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null
  );
}
