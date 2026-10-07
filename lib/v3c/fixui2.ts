// lib/v3c/fixui2.ts (#REDESIGN-V3C fixui2) — pure presentation rules of the third UI round
// (QA-REPORT-2). No I/O, no React: testable. The data rules (guard, prices) stay in fixdata.ts.
import type { V3BoardMatch } from "./contracts";
import { hasStarted, valueToolsAllowed } from "./fixdata";

// ─── N1: the match a tool example may use ───────────────────────────────────

/**
 * The matches a tool example (bench of the home, any card that reuses a match) may use:
 * not started, with a market, and never one the model guard holds back (no_value / market_only:
 * their page shows no EV, Kelly or stake, so no example may show them either).
 */
export function exampleEligible(matches: readonly V3BoardMatch[], now: Date): V3BoardMatch[] {
  return matches.filter((m) => m.margin_removed != null && !hasStarted(m.kickoff, now) && valueToolsAllowed(m));
}

// Any money amount: «€54», «€1,000», «$12», «54 €», «£3.50».
const MONEY = /[€$£]\s?\d[\d.,  ]*|\d[\d.,  ]*\s?[€$£]/;

/**
 * An example output without a money amount: «10.7% · €54» → «10.7%». The examples speak in
 * percentages only (a stake in € belongs to the visitor's own bankroll, in the tool).
 */
export function withoutMoney(s: string): string {
  if (!MONEY.test(s)) return s;
  const parts = s.split(" · ").filter((p) => !MONEY.test(p));
  return parts.length ? parts.join(" · ") : "—";
}

export function hasMoney(s: string): boolean {
  return MONEY.test(s);
}

// ─── N8: sealed before kick-off, or logged after it ─────────────────────────

/** True only when the ledger row is dated strictly before kick-off (an unreadable date is not a seal). */
export function sealedBeforeKickoff(sealedAt: string | null | undefined, kickoff: string | null | undefined): boolean {
  if (!sealedAt) return false;
  const s = Date.parse(sealedAt);
  if (!Number.isFinite(s)) return false;
  if (!kickoff) return true; // no kick-off to compare: the stamp keeps its own (dated) meaning
  const k = Date.parse(kickoff);
  return !Number.isFinite(k) || s < k;
}

/** «7 Oct 16:02» in the given zone (undefined = UTC), no zone abbreviation: the view declares it once. */
export function sealStamp(iso: string, timeZone: string | undefined, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = timeZone ?? "UTC";
  const day = new Intl.DateTimeFormat(locale, { timeZone: tz, day: "numeric", month: "short" }).format(d).replace(/\.$/, "");
  const hm = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day} ${hm}`;
}

// ─── N6: the match the price check opens ────────────────────────────────────

/**
 * `?m=` → the id to open, and whether the request could not be honoured. A requested match not in
 * the list never silently opens another one: the price check opens empty with a message.
 */
export function priceCheckInitial(wanted: string | null, ids: readonly string[], fallback: string | null): { id: string | null; notListed: boolean } {
  if (!wanted) return { id: fallback, notListed: false };
  return ids.includes(wanted) ? { id: wanted, notListed: false } : { id: null, notListed: true };
}
