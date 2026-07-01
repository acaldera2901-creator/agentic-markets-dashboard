// #CARD-REAL-PREDICTIONS-1 / #PREDICT-EVERY-MARKET-1 — join FP curated markets with OUR model.
// ONLY our predictions are shown. Each outcome we model (goal-derived markets incl. Over/Under,
// BTTS, Double Chance, DNB, Odd/Even, Team Totals, 1st Half, Correct Score, Goals Handicap)
// gets our probability + edge vs the shown price. Outcomes we do NOT model return p=null and
// are HIDDEN by the card — we never show a market-derived number dressed up as ours.
// Soft markets (corners/cards/fouls) come from the soft-markets model upstream; markets with
// no model at all are simply not shown.
import type { ExtraMarket } from "./poisson-model";
import type { FpFullMarket } from "./fortuneplay-match";

export interface JoinedOutcome {
  label: string;
  fpOdds: number;
  /** OUR model probability for this outcome, or null when we don't model it.
   * Outcomes with p=null are hidden by the card — we only show our predictions,
   * never a market-derived number dressed up as ours. */
  p: number | null;
  fairOdds: number | null;
  /** p*fpOdds-1 (value vs the shown price); null when unmodeled. */
  edge: number | null;
}

export interface JoinedMarket {
  name: string;
  line: number | null;
  /** true if at least one outcome carries a model prediction */
  modeled: boolean;
  outcomes: JoinedOutcome[];
}

const lineKey = (line: number) => String(line).replace(".", "_");
const norm = (s: string) => s.toLowerCase().trim();

/**
 * Map a single FP (marketName, line, outcomeLabel) to our ExtraMarket key.
 * Returns null when we don't model it. homeTeam/awayTeam needed to read the
 * team-name-based labels FortunePlay uses (e.g. "England or Draw").
 */
export function keyForOutcome(
  marketName: string,
  line: number | null,
  label: string,
  homeTeam: string,
  awayTeam: string
): string | null {
  const n = norm(marketName);
  const l = norm(label);
  const home = norm(homeTeam);
  const away = norm(awayTeam);
  const hasHome = home.length > 0 && l.includes(home);
  const hasAway = away.length > 0 && l.includes(away);
  const hasDraw = l.includes("draw") || l === "x";
  const isOver = l.includes("over");
  const isUnder = l.includes("under");

  // Total goals (full match) — "Over/Under X.Y"
  if (n === "total goals" && line != null) {
    if (isOver) return `over_${lineKey(line)}`;
    if (isUnder) return `under_${lineKey(line)}`;
    return null;
  }
  if (n === "total goals odd/even") {
    if (l.includes("odd")) return "goals_odd";
    if (l.includes("even")) return "goals_even";
    return null;
  }
  if (n === "both teams to score") {
    if (l === "yes" || l.includes("yes")) return "btts_yes";
    if (l === "no" || l.includes("no")) return "btts_no";
    return null;
  }
  if (n === "double chance") {
    // "{home} or Draw"=1X, "Draw or {away}"=X2, "{home} or {away}"=12
    if (hasHome && hasDraw) return "double_1x";
    if (hasAway && hasDraw) return "double_x2";
    if (hasHome && hasAway) return "double_12";
    return null;
  }
  if (n === "draw no bet") {
    if (hasHome || l === "1") return "dnb_home";
    if (hasAway || l === "2") return "dnb_away";
    return null;
  }
  if (n === "team 1 total goals" && line != null) {
    if (isOver) return `team1_over_${lineKey(line)}`;
    return null; // under derived by caller (1 - over) if desired
  }
  if (n === "team 2 total goals" && line != null) {
    if (isOver) return `team2_over_${lineKey(line)}`;
    return null;
  }
  if (/correct score$/.test(n)) {
    // "1-0" or "1:0" → cs_1_0 (home-away order)
    const m = l.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (m) return `cs_${m[1]}_${m[2]}`;
    return null;
  }
  if (n === "1st half result") {
    if (hasHome || l === "1") return "fh_home";
    if (hasDraw) return "fh_draw";
    if (hasAway || l === "2") return "fh_away";
    return null;
  }
  if (n === "1st half total goals" && line != null) {
    if (isOver) return `fh_over_${lineKey(line)}`;
    return null;
  }
  if (n === "1st half both teams to score") {
    if (l.includes("yes")) return "fh_btts_yes";
    if (l.includes("no")) return "fh_btts_no";
    return null;
  }
  // Goals handicap (FULL match only — not "1st half goals handicap"). FP puts the
  // per-side handicap in the label parentheses, e.g. "Belgium (+1.5)" / "Senegal (-1.5)".
  if (n === "goals handicap") {
    const mH = label.match(/\(\s*([+-]?\d+(?:\.\d+)?)\s*\)/);
    if (!mH) return null;
    const k = String(Number(mH[1])).replace(".", "_"); // "+1.5"→"1_5", "-1.5"→"-1_5"
    if (hasHome) return `ah_home_${k}`;
    if (hasAway) return `ah_away_${k}`;
    return null;
  }
  // soft (corners/cards) not modeled here
  return null;
}

/**
 * Enrich curated FP markets with our model predictions. Pure — no fetch.
 * `extra` is the enrichment.extra_markets array from /api/predictions.
 */
export function joinFpWithModel(
  fpMarkets: FpFullMarket[],
  extra: ExtraMarket[],
  homeTeam: string,
  awayTeam: string
): JoinedMarket[] {
  const byKey = new Map<string, ExtraMarket>();
  for (const m of extra) byKey.set(m.key, m);
  const round = (x: number) => Math.round(x * 10000) / 10000;

  const fair = (p: number) => Math.round((1 / Math.max(0.03, Math.min(0.97, p))) * 100) / 100;

  return fpMarkets.map((mkt) => {
    let modeled = false;
    const outcomes: JoinedOutcome[] = mkt.outcomes.map((o) => {
      const key = keyForOutcome(mkt.name, mkt.line, o.label, homeTeam, awayTeam);
      let modelP: number | null = null;
      if (key) {
        const em = byKey.get(key);
        if (em) modelP = em.p;
      }
      // derive Under for team totals when only Over is modeled
      if (modelP == null && norm(o.label).includes("under")) {
        const overKey = keyForOutcome(mkt.name, mkt.line, o.label.replace(/under/i, "Over"), homeTeam, awayTeam);
        if (overKey) {
          const em = byKey.get(overKey);
          if (em) modelP = round(1 - em.p);
        }
      }
      if (modelP == null) {
        // we don't model it → NO number (card hides it). Never show market-derived as ours.
        return { label: o.label, fpOdds: o.odds, p: null, fairOdds: null, edge: null };
      }
      modeled = true;
      return { label: o.label, fpOdds: o.odds, p: round(modelP), fairOdds: fair(modelP), edge: round(modelP * o.odds - 1) };
    });
    return { name: mkt.name, line: mkt.line, modeled, outcomes };
  });
}
