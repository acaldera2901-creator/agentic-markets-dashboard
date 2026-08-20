/**
 * Un solo posto dove si decide COME si parla a ESPN, lato TypeScript
 * (#ESPN-UA-403-0820). Gemello di `core/espn_http.py` — quel file porta la
 * misura completa; qui il minimo per non doverla ri-derivare.
 *
 * ESPN espone la stessa site-API su due hostname: `site.api.espn.com` ha un WAF
 * che filtra sullo User-Agent, `site.web.api.espn.com` no. Payload identici,
 * verificato il 2026-08-20 (262 match singolari, stessi id/date/stati).
 *
 * Sull'host filtrato NIENTE di quello che manda un runtime Node passa:
 * `undici/6.19.8` -> 403, `node-fetch/3.3.2` -> 403, nessun header UA -> 403.
 * Quindi ogni route che chiamava l'host filtrato da Vercel era 403 **sempre**,
 * non a intermittenza.
 *
 * Guardia: `tests/test_espn_host_no_residues.py` fallisce se
 * `site.api.espn.com` ricompare nel repo fuori dai due file gemelli.
 */

export const ESPN_SITE_API = "https://site.web.api.espn.com/apis/site/v2/sports";
export const ESPN_V2_API = "https://site.web.api.espn.com/apis/v2";

/** Ci identifichiamo per quello che siamo: su questo host basta. */
export const ESPN_HEADERS = { "User-Agent": "BetRedge/1.0 (+https://betredge.com)" };
