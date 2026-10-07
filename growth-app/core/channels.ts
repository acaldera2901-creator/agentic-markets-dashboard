// Source chain: source → sessions → signups → profiles → paying. Pure: no I/O.
//
// Two attribution bases live side by side in one row (see buildChainSql):
// sessions/signup events come from consented sessions, profiles/paying from
// profiles.acquisition. A rate is only computed inside one base — never
// "profiles / signup events", which mixes the two and can exceed 100%.

import { INTERNAL_ENTRY_LABEL, foldInternal } from "./estimate";
import type { Result, Row } from "./model";
import { coarsenLabel } from "./privacy";

export interface ChainRow {
  source: string;
  sessions: number;
  signup_started: number;
  signup_completed: number;
  profiles: number;
  paying: number;
}

const COUNTS = ["sessions", "signup_started", "signup_completed", "profiles", "paying"] as const;

/** Below this many signups a source shows counts only, no percentages. */
export const MIN_SIGNUPS_FOR_PCT = 5;

/** Labels that are not a traffic source but a hole in the attribution, shown last. */
export const UNATTRIBUTED = new Set([
  "(non registrata)",
  "(signup senza sessione)",
  "(sessione senza page_view nella finestra)",
]);

/**
 * Fold internal/test sources (on the RAW label, core/estimate.ts), coarsen labels
 * (referrer → registrable domain, referral codes masked) and sum rows that collapse.
 * Idempotent: a snapshot's already-merged rows pass through unchanged.
 */
export function mergeChain(rows: Row[]): Row[] {
  const acc = new Map<string, Row>();
  for (const r of rows) {
    const label = coarsenLabel(foldInternal(String(r.source)));
    const prev = acc.get(label);
    if (prev) for (const k of COUNTS) prev[k] = Number(prev[k]) + Number(r[k]);
    else acc.set(label, { ...r, source: label });
  }
  return [...acc.values()];
}

export function normalizeChain(r: Result<Row[]>): Result<ChainRow[]> {
  if (!r.ok) return r;
  const out: ChainRow[] = [];
  for (const row of mergeChain(r.data)) {
    const c = { source: String(row.source) } as ChainRow;
    for (const k of COUNTS) {
      const v = Number(row[k]);
      if (!Number.isFinite(v)) return { ok: false, error: `valore non numerico in ${k}` };
      c[k] = v;
    }
    out.push(c);
  }
  // Order: sources, then the attribution holes, then the excluded internal/test row.
  const rank = (s: string) => (s === INTERNAL_ENTRY_LABEL ? 2 : UNATTRIBUTED.has(s) ? 1 : 0);
  out.sort(
    (a, b) =>
      rank(a.source) - rank(b.source) ||
      b.sessions - a.sessions ||
      b.profiles - a.profiles ||
      a.source.localeCompare(b.source),
  );
  return { ok: true, data: out };
}

export interface ChainRates {
  /** signup_started / sessions — events base; null under MIN_SIGNUPS_FOR_PCT signups. */
  sessionToSignup: number | null;
  /** paying / profiles — profiles base; null under MIN_SIGNUPS_FOR_PCT profiles. */
  profileToPaying: number | null;
}

export function chainRates(r: ChainRow): ChainRates {
  return {
    sessionToSignup: r.signup_started >= MIN_SIGNUPS_FOR_PCT && r.sessions > 0 ? r.signup_started / r.sessions : null,
    profileToPaying: r.profiles >= MIN_SIGNUPS_FOR_PCT ? r.paying / r.profiles : null,
  };
}

export interface ChainTotals extends Omit<ChainRow, "source"> {
  /** Profiles created in the window with acquisition NULL. */
  profilesUnattributed: number;
  /** Signup events with no session (no consent) or a session outside the window. */
  signupsUnattributed: number;
  /** The internal/test row, excluded from every total above (null when there is none). */
  internal: ChainRow | null;
}

/** Totals WITHOUT the internal/test row, which is returned apart. */
export function chainTotals(rows: ChainRow[]): ChainTotals {
  const t: ChainTotals = { sessions: 0, signup_started: 0, signup_completed: 0, profiles: 0, paying: 0, profilesUnattributed: 0, signupsUnattributed: 0, internal: null };
  for (const r of rows) {
    if (r.source === INTERNAL_ENTRY_LABEL) {
      t.internal = r;
      continue;
    }
    for (const k of COUNTS) t[k] += r[k];
    if (r.source === "(non registrata)") t.profilesUnattributed += r.profiles;
    if (r.source === "(signup senza sessione)" || r.source === "(sessione senza page_view nella finestra)") t.signupsUnattributed += r.signup_started;
  }
  return t;
}
