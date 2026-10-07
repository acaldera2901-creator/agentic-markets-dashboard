// "Probably human" page views and entry sources — pure definitions, no I/O.
//
// The filter is an ESTIMATE: events has no user-agent, so "not human" is
// deduced from country / timing, never observed. Classes and thresholds come
// from the diagnosis of 06/10 (docs/proposals/sessioni-1006.md, #SESSIONI-1006).
// core/sql.ts implements the same rules in SQL; scripts/verify.ts checks the
// SQL against classifyBuckets() below, run on independently grouped counts.

/** Countries with page views but no consented session in the 30 days of the diagnosis (crawler pattern). */
export const NO_SESSION_COUNTRIES = ["US", "RU", "IN", "SG", "TR", "SS"] as const;
/** A burst: at least BURST_MIN page views without session, same country, same fixed 10-minute slot. */
export const BURST_MIN = 8;
export const BURST_SLOT_SECONDS = 600;

export const HUMAN_FILTER_CRITERIA = [
  "senza paese: test locali, job sintetici o crawler (causa non determinabile dai dati; nessun header geo di Vercel) — tutti, con o senza sessione",
  `senza sessione e da un paese che nella diagnosi del 06/10 non aveva nessuna sessione (${NO_SESSION_COUNTRIES.join(", ")}) — lista fissa, un umano da quei paesi senza consenso viene escluso anche lui`,
  `senza sessione e dentro una raffica: almeno ${BURST_MIN} page view senza sessione dallo stesso paese nella stessa fascia fissa di ${BURST_SLOT_SECONDS / 60} minuti`,
] as const;

/** Page views grouped by (country, 10-minute slot); counts split by session presence. */
export interface PvBucket {
  country: string | null;
  slot: number;
  noSession: number;
  withSession: number;
}

export interface HumanEstimate {
  page_views: number;
  excl_no_country: number;
  excl_country: number;
  excl_burst: number;
  probably_human: number;
}

const LISTED = new Set<string>(NO_SESSION_COUNTRIES);

/** Exclusive classes in this order: no country → listed country → burst. */
export function classifyBuckets(buckets: PvBucket[]): HumanEstimate {
  const out: HumanEstimate = { page_views: 0, excl_no_country: 0, excl_country: 0, excl_burst: 0, probably_human: 0 };
  // Several rows may share (country, slot): the burst size is their sum.
  const burst = new Map<string, number>();
  for (const b of buckets) {
    const k = `${b.country ?? ""}|${b.slot}`;
    burst.set(k, (burst.get(k) ?? 0) + b.noSession);
  }
  for (const b of buckets) {
    out.page_views += b.noSession + b.withSession;
    if (!b.country) {
      out.excl_no_country += b.noSession + b.withSession;
      continue;
    }
    out.probably_human += b.withSession;
    if (LISTED.has(b.country)) out.excl_country += b.noSession;
    else if ((burst.get(`${b.country}|${b.slot}`) ?? 0) >= BURST_MIN) out.excl_burst += b.noSession;
    else out.probably_human += b.noSession;
  }
  return out;
}

/** Above this share of page views without country, the totals of a window are flagged (#GROWTH-V5). */
export const NO_COUNTRY_SPIKE_SHARE = 0.3;

/**
 * Share of page views without country and whether it is an anomalous spike
 * (strictly above NO_COUNTRY_SPIKE_SHARE). null share when there are no page views.
 */
export function noCountrySpike(noCountry: number, pageViews: number): { share: number | null; spike: boolean } {
  if (!(pageViews > 0)) return { share: null, spike: false };
  const share = noCountry / pageViews;
  return { share, spike: share > NO_COUNTRY_SPIKE_SHARE };
}

// Sources that are our own previews/studios or explicit tests, not acquisition.
// Measured 06–07/10: 16 entries from betredge-studio-0922.<personal-name>.chatgpt.site,
// src=pr-check 5, utm test123 3, referrer localhost 2, utm qa 1, utm 3Dcoldmail 1
// (a coldmail link broken by quoted-printable, «=3D»). Hosts are matched on the
// RAW host, before core/privacy.ts cuts it to the domain. #GROWTH-V7: the same
// rule folds entries, sessions per source, the chain and signups per channel.
// Country is NEVER a rule here: traffic is not filtered by where it comes from.
const INTERNAL_REFERRER_RES = [/^betredge-studio[^.]*\.(?:[^.]+\.)*chatgpt\.site$/, /^betredge[^.]*\.vercel\.app$/, /^localhost$/, /^127\.\d+\.\d+\.\d+$/];
/** utm_source / src / crm values that only our tests use (case-insensitive, exact). */
export const INTERNAL_SOURCE_VALUES = ["pr-check", "test123", "qa", "3dcoldmail"] as const;
export const INTERNAL_REFERRER_RULE =
  "interni/test = utm_source, src o crm uguale a pr-check, test123, qa o 3Dcoldmail (link di prova o rotti), oppure referrer localhost/127.x, betredge-studio*.….chatgpt.site (anteprime del nostro studio) o betredge*.vercel.app (deploy e preview dei progetti betredge); il referrer conta solo quando l'ingresso non ha utm/src/crm/ref. Il paese non è mai un criterio";
/** The single label every internal/test source is folded into (no host, so no personal name). */
export const INTERNAL_ENTRY_LABEL = "(interni/test, esclusi)";

export function isInternalReferrer(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
  return INTERNAL_REFERRER_RES.some((re) => re.test(h));
}

/** True for a source label (as built by the queries) that is ours or an explicit test. */
export function isInternalSource(label: string): boolean {
  if (label.startsWith("referrer:")) return isInternalReferrer(label.slice("referrer:".length));
  if (label.startsWith("ref:") || label.startsWith("(")) return false;
  const value = label.startsWith("src:") || label.startsWith("crm:") ? label.slice(4) : label;
  return (INTERNAL_SOURCE_VALUES as readonly string[]).includes(value.trim().toLowerCase());
}

/** A source label as stored: internal/test sources folded into INTERNAL_ENTRY_LABEL, the rest unchanged. */
export function foldInternal(label: string): string {
  return isInternalSource(label) ? INTERNAL_ENTRY_LABEL : label;
}

export type EntryRow = { source: string; entries: number };

/** Rows split into acquisition sources and the folded internal/test row (its count only). */
export function splitFolded<T>(rows: T[], label: (r: T) => string, count: (r: T) => number): { external: T[]; internal: number } {
  const internal = rows.filter((r) => label(r) === INTERNAL_ENTRY_LABEL).reduce((s, r) => s + count(r), 0);
  return { external: rows.filter((r) => label(r) !== INTERNAL_ENTRY_LABEL), internal };
}

/** Entries split into acquisition sources and our own previews/studios/tests (folded by foldInternal). */
export function splitEntries(rows: EntryRow[]): { external: EntryRow[]; internal: number } {
  return splitFolded(rows, (r) => r.source, (r) => r.entries);
}

export interface EntryMeta {
  utm_source?: string | null;
  src?: string | null;
  crm?: string | null;
  ref?: string | null;
  ref_host?: string | null;
}

/**
 * The «probably human» estimate's margin, measured by the audit of 07/10 with
 * alternative criteria on the same data (consented + country … this page's rule).
 * Historical: dated, never recomputed — it says how wide the uncertainty is.
 */
export const HUMAN_ESTIMATE_MARGIN = "con criteri alternativi l'audit del 07/10 ha ottenuto 109–310 a 7 giorni e 685–2.148 a 30 giorni (il valore di questa pagina è il massimo): la stima può essere fino a circa 3 volte troppo alta";

/**
 * Source label of an entry page view (same precedence as the `sources` query),
 * or null when the page view carries no source key. Raw: referrer hosts and
 * referral codes still go through core/privacy.ts before leaving the source.
 */
export function entryLabel(m: EntryMeta): string | null {
  const v = (x: string | null | undefined) => (x === null || x === undefined || x === "" ? null : x);
  if (v(m.utm_source)) return m.utm_source!;
  if (v(m.src)) return `src:${m.src}`;
  if (v(m.crm)) return `crm:${m.crm}`;
  if (v(m.ref)) return `ref:${m.ref}`;
  if (v(m.ref_host)) return `referrer:${m.ref_host}`;
  return null;
}
