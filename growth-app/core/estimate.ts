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
  "senza paese (nessun header geo di Vercel: probabili test locali che scrivono sul DB di produzione) — tutti, con o senza sessione",
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

export interface EntryMeta {
  utm_source?: string | null;
  src?: string | null;
  crm?: string | null;
  ref?: string | null;
  ref_host?: string | null;
}

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
