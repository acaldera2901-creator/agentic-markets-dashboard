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

// #CALCIO-1001 — ESPN answers 400 to every `dates=YYYYMMDD-YYYYMMDD` range
// (since 15/09/2026; re-measured 01/10: range 400, single day and YYYYMM 200).
// Ranges are read as whole months instead (`fetchEspnFinalsByDate(slug,
// "YYYYMM")`): 1-2 requests, like core/espn_soccer_client.py::_scoreboard_window.

/** How long an open served row keeps being retried before step E seals it
 *  'unresolved'. Was 48h: a source outage of two days lost the result for
 *  good (217 sealed football picks, 03/07-26/09). */
export const ESPN_RECOVERY_DAYS = 7;

/** ESPN files a match under its US day: 02:30Z on the 1st sits in the
 *  previous day's (and month's) scoreboard. */
const ESPN_DAY_SHIFT_MS = 6 * 60 * 60 * 1000;

/** YYYYMM of every month ESPN may file a match between `from` and `to`. */
export function mesiEspn(from: Date, to: Date): string[] {
  const out: string[] = [];
  const start = new Date(from.getTime() - ESPN_DAY_SHIFT_MS);
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur.getTime() <= to.getTime()) {
    out.push(`${cur.getUTCFullYear()}${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}
