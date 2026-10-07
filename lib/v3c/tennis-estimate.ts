// lib/v3c/tennis-estimate.ts (#REDESIGN-V3C tennis2) — the tennis Market → Estimate → Gap,
// defined as ml-engineer-agentic measured it (redesign/proposals/tennis-estimate.md, 07/10,
// N = 1,106 matches, SELECT only). Pure functions, no I/O: the board service, the UI and the
// tests all read the same numbers from here.
//
// The binding definition (Andrea, 07/10):
//   * estimate = 0.1·Elo + 0.9·market without margin, ONLY when the raw Elo (last
//     prediction_log snapshot before the start that has both Elo and market) is ≤ 6 h old
//     AND the match is ATP/WTA main tour. Label «Elo-based, not sealed».
//     The 30/70 football blend is measurably WORSE than the market in tennis
//     (Brier +0.0025 [+0.0004; +0.0046]); 0.1 is the data-optimal cap.
//   * everywhere else «Market only»: no estimate, no gap.
//   * never the temperature τ = 1.68 on the displayed estimate.
//   * gap = estimate − market (= 0.1·(Elo − market)): muted, never a value signal or a
//     ranking input; hidden when |Elo − market| > 25 pp (where the Elo has been most wrong).
//
// The market of the blend is the de-vigged pair the row shows in its Market column
// (tennis_predictions.odds_*), so Market + Gap = Estimate on screen. The Elo comes from the
// shadow log (client clock, not sealed): hence «not sealed», and no record claims.
import { PARTNER_MARKET_MODEL } from "@/lib/partner-market";
import { canonicalPlayerKey } from "@/lib/tennis-names";
import { roundP } from "./prob";

export type TennisEstimateKind = "elo_blend_unsealed" | "market_only";

/** Weight of our Elo in the displayed tennis estimate (the rest is the market). */
export const TENNIS_ELO_WEIGHT = 0.1;
/** Max age of the raw Elo snapshot for an estimate (minutes). */
export const TENNIS_ELO_MAX_AGE_MIN = 360;
/** |raw Elo − market| above which the gap is hidden (percentage points). */
export const TENNIS_GAP_HIDE_PP = 25;
/** Expected share of tennis board rows with an estimate (measured 07/10: 28/175 Elo rows ≈ 16%). */
export const TENNIS_ESTIMATE_EXPECTED_COVERAGE = 0.16;

/** Circuits outside ATP/WTA main tour (and other sports) as they appear in tournament names. */
const NOT_MAIN_TOUR = /challenger|\bitf\b|\bwtt\b|\butr\b|\b125\b|doubles|padel/i;

export type TennisCategory = "singles" | "doubles" | "padel";

type CatInput = { tournament: string | null; partner_tournament?: string | null; player1: string; player2: string };

/**
 * Singles, doubles or padel. The partner feed writes «Partner feed» as tournament; the real
 * name («Padel Tour Dusseldorf», «WTA Samsun - Hard (Doubles)») is in feature_snapshot.partner.
 * A pair on each side («A/B – C/D») is a doubles match even without the word.
 */
export function tennisCategory(r: CatInput): TennisCategory {
  const names = `${r.partner_tournament ?? ""} ${r.tournament ?? ""}`;
  if (/padel/i.test(names)) return "padel";
  if (/doubles/i.test(names) || (r.player1.includes("/") && r.player2.includes("/"))) return "doubles";
  return "singles";
}

/** Singles only on the tennis board; padel and doubles counted, not shown. */
export function splitTennisCategories<T extends CatInput>(rows: T[]): { singles: T[]; removed: { padel: number; doubles: number } } {
  const removed = { padel: 0, doubles: 0 };
  const singles: T[] = [];
  for (const r of rows) {
    const c = tennisCategory(r);
    if (c === "singles") singles.push(r);
    else removed[c] += 1;
  }
  return { singles, removed };
}

/** ATP/WTA main tour with our Elo: only the Elo agent's rows (ESPN tour feeds), never Challenger/ITF/WTT/UTR. */
export function isMainTourElo(r: CatInput & { model_version: string }): boolean {
  if (r.model_version === PARTNER_MARKET_MODEL) return false;
  if (tennisCategory(r) !== "singles") return false;
  return !NOT_MAIN_TOUR.test(`${r.partner_tournament ?? ""} ${r.tournament ?? ""}`);
}

export type TennisEstimateInput = CatInput & {
  model_version: string;
  /** de-vigged market of the row (what the Market column shows) */
  market_p1: number | null;
  market_p2: number | null;
  /** raw Elo of the last pre-start prediction_log snapshot with Elo AND market */
  elo_p1?: number | null;
  elo_p2?: number | null;
  elo_as_of?: string | null;
  /** prediction_log.home_team of that snapshot (orientation check) */
  elo_home?: string | null;
};

export type TennisEstimate = {
  estimate_kind: TennisEstimateKind;
  estimate_p: { p1: number; p2: number } | null;
  elo_p_raw: { p1: number; p2: number } | null;
  elo_age_min: number | null;
  elo_as_of: string | null;
  /** estimate − market, signed pp, 2 decimals; null for market_only */
  gap_pp: { p1: number; p2: number } | null;
  gap_visible: boolean;
};

const MARKET_ONLY = (elo: { p1: number; p2: number } | null, age: number | null, asOf: string | null): TennisEstimate => ({
  estimate_kind: "market_only",
  estimate_p: null,
  elo_p_raw: elo,
  elo_age_min: age,
  elo_as_of: asOf,
  gap_pp: null,
  gap_visible: false,
});

const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;

/** The raw Elo oriented to player1/player2, renormalised to sum 1; null if missing or not this pair. */
export function orientElo(r: TennisEstimateInput): { p1: number; p2: number } | null {
  if (!ok(r.elo_p1) || !ok(r.elo_p2)) return null;
  const s = r.elo_p1 + r.elo_p2;
  if (!(s > 0)) return null;
  let a = r.elo_p1 / s;
  if (r.elo_home) {
    const h = canonicalPlayerKey(r.elo_home);
    if (h !== canonicalPlayerKey(r.player1)) {
      if (h === canonicalPlayerKey(r.player2)) a = 1 - a;
      else return null; // the snapshot is about another pairing: never guess
    }
  }
  return { p1: a, p2: 1 - a };
}

/**
 * The displayed tennis estimate of one board row. `now` dates the Elo snapshot.
 */
export function tennisEstimate(r: TennisEstimateInput, now: Date): TennisEstimate {
  const elo = orientElo(r);
  const t = r.elo_as_of ? Date.parse(r.elo_as_of) : NaN;
  const age = Number.isFinite(t) ? Math.max(0, Math.round((now.getTime() - t) / 60_000)) : null;
  const asOf = Number.isFinite(t) ? new Date(t).toISOString() : null;
  const eloOut = elo ? { p1: roundP(elo.p1), p2: roundP(elo.p2) } : null;
  if (!isMainTourElo(r) || !elo || age == null || age > TENNIS_ELO_MAX_AGE_MIN || !ok(r.market_p1) || !ok(r.market_p2))
    return MARKET_ONLY(eloOut, age, asOf);
  const w = TENNIS_ELO_WEIGHT;
  const e1 = w * elo.p1 + (1 - w) * r.market_p1;
  const e2 = w * elo.p2 + (1 - w) * r.market_p2;
  const pp = (x: number) => Math.round(x * 10_000) / 100;
  return {
    estimate_kind: "elo_blend_unsealed",
    estimate_p: { p1: roundP(e1), p2: roundP(e2) },
    elo_p_raw: eloOut,
    elo_age_min: age,
    elo_as_of: asOf,
    gap_pp: { p1: pp(e1 - r.market_p1), p2: pp(e2 - r.market_p2) },
    gap_visible: Math.abs(elo.p1 - r.market_p1) * 100 <= TENNIS_GAP_HIDE_PP,
  };
}

// ─── duplicates: the same match served by the partner feed AND by the Elo agent ───

type DupRow = { id: string; kickoff: string; player1: string; player2: string; model_version: string };

const lastAndInitial = (n: string) => {
  const k = canonicalPlayerKey(n).split(" ").filter(Boolean);
  return k.length ? `${k[k.length - 1]}.${k[0][0]}` : "";
};
const pairOf = (f: (n: string) => string, a: string, b: string) => [f(a), f(b)].sort().join("|");
/** Same two players within 36 h: the partner feed's kickoff is often a placeholder hours off the real start. */
const DUP_WINDOW_MS = 36 * 3_600_000;

export type TennisDedupe<T> = {
  kept: T[];
  /** dropped id → kept id (the kept row also gets the dropped row's book prices) */
  dropped: Map<string, string>;
};

/**
 * One row per match. Two rows are the same match when they carry the same two players
 * (canonical names, or surname + first initial: «Darya/Daria Khamutsianskaya») within 36 h,
 * one from the partner feed and one from the Elo agent. Kept: the Elo row when it has an
 * estimate (`hasEstimate`), otherwise the partner row (it carries the price).
 */
export function dedupeTennisRows<T extends DupRow>(rows: T[], hasEstimate: (r: T) => boolean): TennisDedupe<T> {
  const dropped = new Map<string, string>();
  const elo = rows.filter((r) => r.model_version !== PARTNER_MARKET_MODEL);
  const partner = rows.filter((r) => r.model_version === PARTNER_MARKET_MODEL);
  const near = (a: T, b: T) => Math.abs(Date.parse(a.kickoff) - Date.parse(b.kickoff)) <= DUP_WINDOW_MS;
  const used = new Set<string>();
  for (const e of elo) {
    const exact = pairOf(canonicalPlayerKey, e.player1, e.player2);
    const loose = pairOf(lastAndInitial, e.player1, e.player2);
    const twin =
      partner.find((p) => !used.has(p.id) && near(p, e) && pairOf(canonicalPlayerKey, p.player1, p.player2) === exact) ??
      partner.find((p) => !used.has(p.id) && near(p, e) && pairOf(lastAndInitial, p.player1, p.player2) === loose);
    if (!twin) continue;
    used.add(twin.id);
    if (hasEstimate(e)) dropped.set(twin.id, e.id);
    else dropped.set(e.id, twin.id);
  }
  return { kept: rows.filter((r) => !dropped.has(r.id)), dropped };
}

/** The lead side's numbers for a row/page: market → estimate → gap, or market only. */
export function tennisEstimateOf(
  m: { estimate_kind?: TennisEstimateKind; estimate_p?: { p1: number; p2: number } | null; gap_pp?: { p1: number; p2: number } | null; gap_visible?: boolean },
  side: "p1" | "p2",
): { kind: TennisEstimateKind; estimate: number | null; gap: number | null } {
  if (m.estimate_kind !== "elo_blend_unsealed" || !m.estimate_p) return { kind: "market_only", estimate: null, gap: null };
  return { kind: "elo_blend_unsealed", estimate: m.estimate_p[side], gap: m.gap_visible && m.gap_pp ? m.gap_pp[side] : null };
}
