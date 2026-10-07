// lib/v3c/fixdata.ts (#REDESIGN-V3C fixdata) — the data/logic fixes of QA-REPORT v3c-final3,
// pure functions, no I/O, one place each:
//   B1  a match that has started is never a pre-match row (no best price, no book CTA);
//   B1  the board order: relevance tier, then kick-off;
//   B5  the model sanity guard (raw model vs no-vig market, 15 / 25 pp);
//   B6  the same football match twice on the board (rescheduled: same teams within ±48 h);
//   M4  the tools' input ranges (a price is 1.01–1000), with the reason a value is refused.
import { normName } from "@/lib/odds-api";
import type { V3BoardMatch, V3BoardOutcome } from "./contracts";

// ─── B1: started matches ────────────────────────────────────────────────────

/** True once the kick-off has passed (a clock a minute early is still pre-match). */
export function hasStarted(kickoffIso: string, now: Date): boolean {
  const k = Date.parse(kickoffIso);
  return Number.isFinite(k) && k <= now.getTime();
}

// ─── B1: relevance tiers ────────────────────────────────────────────────────

/**
 * The football competitions read first: the five top leagues and the three UEFA club cups.
 * Exact names (as unified_predictions and the feeds write them) and the football-data codes:
 * «Austrian Bundesliga» or Brazil's «Serie A» are other leagues.
 */
const TOP_FOOTBALL = new Set([
  "premier league", "la liga", "laliga", "serie a", "bundesliga", "ligue 1",
  "champions league", "uefa champions league", "europa league", "uefa europa league",
  "conference league", "uefa conference league", "uefa europa conference league",
  "pl", "pd", "sa", "bl1", "fl1", "cl",
]);
const NOT_MAIN_TOUR = /challenger|\bitf\b|\bwtt\b|\butr\b|\b125\b|doubles|padel|\bm15\b|\bm25\b|\bw\d{2,3}\b/i;

/**
 * 0 = top-league football · 1 = ATP/WTA main tour · 2 = other football · 3 = other tennis.
 * Tennis reads the real tournament behind «Partner feed» when the row has it.
 */
export function relevanceTier(r: { sport: "football"; competition: string | null; league: string | null } | { sport: "tennis"; tournament: string | null; partner_tournament?: string | null }): number {
  if (r.sport === "football") {
    const names = [r.competition, r.league].map((x) => (x ?? "").trim().toLowerCase());
    return names.some((n) => TOP_FOOTBALL.has(n)) ? 0 : 2;
  }
  const t = `${r.partner_tournament ?? ""} ${r.tournament ?? ""}`;
  return /\b(atp|wta)\b/i.test(t) && !NOT_MAIN_TOUR.test(t) ? 1 : 3;
}

/** The board order inside a day (and the home's choice): relevance tier, then kick-off, then id. */
export function byRelevance(a: { relevance?: number; kickoff: string; id: string }, b: { relevance?: number; kickoff: string; id: string }): number {
  return (a.relevance ?? 2) - (b.relevance ?? 2) || Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id);
}

// ─── B5: the model sanity guard ─────────────────────────────────────────────

/** Above this |raw model − market| (pp, any outcome) no EV, Kelly, stake or edge badge is shown. */
export const GUARD_NO_VALUE_PP = 15;
/** Above this the estimate shown IS the market (gap 0): «Market only». */
export const GUARD_MARKET_ONLY_PP = 25;

/** fixdata2 N3: «no_market» = no market and no partner-book price to compare with: no estimate, no fair price, no EV/Kelly. */
export type ModelGuardLevel = "ok" | "no_value" | "market_only" | "no_market";
/**
 * fixdata2: why the level is not «ok» — model_far (raw model vs market, B5), price_far (the estimate's fair
 * price > 25% from the best real price, N3), no_market (N3). Optional: older payloads have no reason.
 */
export type ModelGuard = { level: ModelGuardLevel; delta_pp: number | null; reason?: "model_far" | "price_far" | "no_market" };

/**
 * The largest |raw model − de-vigged market| over the outcomes, in pp. The football estimate is
 * 0.3·model + 0.7·market, so its gap hides two thirds of a model that disagrees wildly
 * (Cercle 84% vs market 27% → estimate 44%, gap +16.9): the guard reads the RAW model.
 * Without a market or without the raw model there is nothing to compare: «ok».
 */
export function modelGuard(outcomes: readonly { model_p: number | null; market_p: number | null }[]): ModelGuard {
  let d: number | null = null;
  for (const o of outcomes) {
    if (o.model_p == null || o.market_p == null || !Number.isFinite(o.model_p) || !Number.isFinite(o.market_p)) continue;
    const x = Math.abs(o.model_p - o.market_p) * 100;
    d = d == null ? x : Math.max(d, x);
  }
  if (d == null) return { level: "ok", delta_pp: null };
  const delta_pp = Math.round(d * 10) / 10;
  const level: ModelGuardLevel = d > GUARD_MARKET_ONLY_PP ? "market_only" : d > GUARD_NO_VALUE_PP ? "no_value" : "ok";
  return level === "ok" ? { level, delta_pp } : { level, delta_pp, reason: "model_far" };
}

/** «market_only»: the shown estimate is the market and the gap is 0 (raw numbers stay in model_p). */
export function applyGuard(outcomes: V3BoardOutcome[], g: ModelGuard): V3BoardOutcome[] {
  if (g.level !== "market_only") return outcomes;
  return outcomes.map((o) => (o.market_p == null ? o : { ...o, estimate_p: o.market_p, edge_pp: 0 }));
}

/** EV, Kelly, a stake or an edge badge may be shown only when the guard is «ok» (a missing guard = an older payload = ok). */
export function valueToolsAllowed(m: Pick<V3BoardMatch, "model_guard">): boolean {
  return (m.model_guard?.level ?? "ok") === "ok";
}

// ─── B6: the same football match twice on the board ─────────────────────────

/** Same home and away (normalised) with kick-offs this close = one match listed twice (rescheduled). */
export const BOARD_TWIN_WINDOW_H = 48;
/** Two snapshots this close count as the same refresh run (the cron writes every 2 h). */
const SAME_RUN_MS = 30 * 60_000;

type TwinRow = { id: string; home: string; away: string; kickoff: string; computed_at: string };

/**
 * Measured 07/10 (SELECT): Shamrock–Drogheda 8/10 and 9/10, Aberdeen–St Johnstone 10/10 and 11/10,
 * Qingdao–Beijing 9/10 and 10/10 — the feed kept the old date of a rescheduled match. The row the
 * pipeline still refreshes is the live one (the stale one stopped days ago); on a tie (both from the
 * same run) the later kick-off, the one the books list. Reverse fixtures are never merged.
 */
export function dedupeFootballBoard<T extends TwinRow>(rows: T[], norm: (n: string) => string = normName): { kept: T[]; dropped: Map<string, string> } {
  const windowMs = BOARD_TWIN_WINDOW_H * 3_600_000;
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = `${norm(r.home)}|${norm(r.away)}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const better = (a: T, b: T): T => {
    const ca = Date.parse(a.computed_at);
    const cb = Date.parse(b.computed_at);
    if (Math.abs(ca - cb) > SAME_RUN_MS) return ca > cb ? a : b;
    const ka = Date.parse(a.kickoff);
    const kb = Date.parse(b.kickoff);
    if (ka !== kb) return ka > kb ? a : b;
    return a.id <= b.id ? a : b;
  };
  const dropped = new Map<string, string>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
    let first = list[0];
    let best = first;
    for (const r of list.slice(1)) {
      if (Date.parse(r.kickoff) - Date.parse(first.kickoff) <= windowMs) {
        const keep = better(best, r);
        dropped.set((keep === best ? r : best).id, keep.id);
        // a row dropped earlier now points at the new winner
        for (const [d, k] of dropped) if (k !== keep.id && (k === best.id || k === r.id)) dropped.set(d, keep.id);
        best = keep;
      } else {
        first = r;
        best = r;
      }
    }
  }
  return { kept: dropped.size ? rows.filter((r) => !dropped.has(r.id)) : rows, dropped };
}

// ─── M4: tool input ranges ──────────────────────────────────────────────────

export const PRICE_MIN = 1.01;
export const PRICE_MAX = 1000;
export const MONEY_MAX = 1_000_000;
export const COUNT_MAX = 100_000;

export type InputProblem = "empty" | "range" | "integer" | null;

/** The bounds of an input kind (for the error message): [min, max], both inclusive. */
export function inputBounds(kind: "price" | "percent" | "money" | "signed" | "count" | "rate"): [number, number] {
  switch (kind) {
    case "price":
      return [PRICE_MIN, PRICE_MAX];
    case "percent":
      return [0.01, 99.99];
    case "money":
      return [0.01, MONEY_MAX];
    case "signed":
      return [-MONEY_MAX, MONEY_MAX];
    case "count":
      return [1, COUNT_MAX];
    case "rate":
      return [0, 100];
  }
}

/** Why a value is refused (null = fine). Empty / not a number → «empty»; outside the bounds → «range». */
export function inputProblem(kind: Parameters<typeof inputBounds>[0], v: number | null | undefined): InputProblem {
  if (v == null || !Number.isFinite(v)) return "empty";
  if (kind === "count" && !Number.isInteger(v)) return "integer";
  const [lo, hi] = inputBounds(kind);
  if (kind === "percent" ? !(v > 0 && v < 100) : v < lo || v > hi) return "range";
  return null;
}

/** The short zone name of a time («CEST», «GMT+2»), for «price at 14:52 CEST» (B2). */
export function zoneAbbr(iso: string, timeZone: string | undefined, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const p = new Intl.DateTimeFormat(locale, { timeZone: timeZone ?? "UTC", timeZoneName: "short" }).formatToParts(d);
    return p.find((x) => x.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
