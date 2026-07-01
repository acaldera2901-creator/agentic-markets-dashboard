// #CARD-REAL-PREDICTIONS-1 — join FortunePlay curated markets with our model.
// For every outcome the card shows, attach the model probability, fair odds and
// edge from lib/poisson-model.computeExtraMarkets. Markets we do NOT model
// honestly (soft corners/cards per-team, goals handicap) are returned with
// prediction=null — the card shows the FP odds but claims no pick. We never
// fabricate a probability.
import type { ExtraMarket } from "./poisson-model";
import type { FpFullMarket } from "./fortuneplay-match";

export interface JoinedOutcome {
  label: string;
  fpOdds: number;
  /** our model probability for this outcome, or null when unmodeled */
  p: number | null;
  fairOdds: number | null;
  /** p*fpOdds-1, rounded; null when unmodeled */
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
  // soft (corners/cards) + goals handicap: not modeled here
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

  return fpMarkets.map((mkt) => {
    let modeled = false;
    const outcomes: JoinedOutcome[] = mkt.outcomes.map((o) => {
      const key = keyForOutcome(mkt.name, mkt.line, o.label, homeTeam, awayTeam);
      let p: number | null = null;
      if (key) {
        const em = byKey.get(key);
        if (em) p = em.p;
      }
      // derive Under for team totals when only Over is modeled
      if (p == null && norm(o.label).includes("under")) {
        const overKey = keyForOutcome(mkt.name, mkt.line, o.label.replace(/under/i, "Over"), homeTeam, awayTeam);
        if (overKey) {
          const em = byKey.get(overKey);
          if (em) p = round(1 - em.p);
        }
      }
      if (p != null) modeled = true;
      const fairOdds = p != null ? Math.round((1 / Math.max(0.03, Math.min(0.97, p))) * 100) / 100 : null;
      const edge = p != null ? round(p * o.odds - 1) : null;
      return { label: o.label, fpOdds: o.odds, p, fairOdds, edge };
    });
    return { name: mkt.name, line: mkt.line, modeled, outcomes };
  });
}
