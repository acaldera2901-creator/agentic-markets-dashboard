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
  "no country: local tests, synthetic jobs or crawlers (cause not determinable from the data; no Vercel geo header) — all of them, with or without a session",
  `no session and from a country that had no session at all in the Oct 6 diagnosis (${NO_SESSION_COUNTRIES.join(", ")}) — fixed list, a human from those countries without consent is excluded too`,
  `no session and inside a burst: at least ${BURST_MIN} page views without a session from the same country in the same fixed ${BURST_SLOT_SECONDS / 60}-minute slot`,
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
  "internal/test = utm_source, src or crm equal to pr-check, test123, qa or 3Dcoldmail (test or broken links), or referrer localhost/127.x, betredge-studio*.….chatgpt.site (previews from our studio) or betredge*.vercel.app (deploys and previews of the betredge projects); the referrer counts only when the entry has no utm/src/crm/ref. Country is never a criterion";
/**
 * The single label every internal/test source is folded into (no host, so no personal name).
 * A DATA key (stored in the snapshot): the UI shows it through sourceLabel() in ui/primitives.tsx.
 */
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
export const HUMAN_ESTIMATE_MARGIN = "with alternative criteria the Oct 7 audit got 109–310 over 7 days and 685–2,148 over 30 days (this page's value is the maximum): the estimate can be up to about 3 times too high";

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
