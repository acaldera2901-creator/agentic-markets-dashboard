export type ExtraMarket = { key: string; label: string; p: number; model_odds: number; market_odds: number | null; edge: number | null };
export type GoalscorerMarket = { playerId: string; name: string; side: "home" | "away"; pScores: number; marketImplied: number | null; bestPrice: number | null; bookmaker: string | null; edge: number | null; confidence: "alta" | "media" };
export type SoftLine = { expected: number; main_line: number; p_over: number; is_generic: boolean };

export type RichPrediction = {
  match_id: string; league: string; league_name: string;
  home_team: string; away_team: string; kickoff: string;
  p_home: number; p_draw: number; p_away: number;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
  edge: number | null; best_selection: string | null;
  confidence_score?: number | null;
  match_type?: string | null; is_estimate?: boolean; locked?: boolean;
  enrichment?: {
    extra_markets?: ExtraMarket[]; goalscorer_markets?: GoalscorerMarket[];
    goals_summary?: { expected_goals: number };
    soft?: { cards?: SoftLine; fouls?: SoftLine; corners?: SoftLine };
    soft_locked?: boolean; explanation?: string | null; research?: string | null;
  } | null;
};

export type MarketChip = { id: string; market: string; selection: string; prob: number | null; odds: number | null; hasValue: boolean; recommended: boolean };
export type MarketGroup = { key: "esiti" | "gol" | "marcatori" | "soft"; title: string; locked?: boolean; chips: MarketChip[]; note?: string };
export type ModelVsMarket = { modelProb: number | null; impliedProb: number | null; bestOdds: number | null; edgePct: number | null };

type PickKey = "HOME" | "DRAW" | "AWAY";
function topKey(r: RichPrediction): PickKey {
  return r.p_home >= r.p_draw && r.p_home >= r.p_away ? "HOME" : r.p_draw >= r.p_away ? "DRAW" : "AWAY";
}
function pickKey(r: RichPrediction): PickKey {
  const bs = (r.best_selection ?? "").toUpperCase();
  return bs === "HOME" || bs === "DRAW" || bs === "AWAY" ? (bs as PickKey) : topKey(r);
}
function oddsFor(r: RichPrediction, k: PickKey): number | null {
  return k === "HOME" ? r.odds_home : k === "AWAY" ? r.odds_away : r.odds_draw;
}
function probFor(r: RichPrediction, k: PickKey): number {
  return k === "HOME" ? r.p_home : k === "AWAY" ? r.p_away : r.p_draw;
}

export function buildModelVsMarket(r: RichPrediction): ModelVsMarket {
  const k = pickKey(r);
  const bestOdds = oddsFor(r, k);
  return {
    modelProb: probFor(r, k),
    impliedProb: bestOdds && bestOdds > 0 ? 1 / bestOdds : null,
    bestOdds,
    edgePct: r.edge != null && r.edge > 0 ? r.edge * 100 : null,
  };
}

export function buildMainGroups(r: RichPrediction): MarketGroup[] {
  const groups: MarketGroup[] = [];
  const k = pickKey(r);

  // Esiti 1X2
  const esiti: { key: PickKey; sel: string; prob: number }[] = [
    { key: "HOME", sel: r.home_team, prob: r.p_home },
    { key: "DRAW", sel: "Pareggio", prob: r.p_draw },
    { key: "AWAY", sel: r.away_team, prob: r.p_away },
  ];
  groups.push({
    key: "esiti", title: "Esiti principali",
    chips: esiti.map((o) => {
      const odds = oddsFor(r, o.key);
      const edge = odds && odds > 0 ? o.prob - 1 / odds : null;
      return { id: `esiti-${o.key}`, market: "Esito 1X2", selection: o.key === "HOME" ? `Vince ${o.sel}` : o.key === "AWAY" ? `Vince ${o.sel}` : "Pareggio",
        prob: o.prob, odds, hasValue: (edge ?? 0) > 0, recommended: o.key === k };
    }),
  });

  // Gol Over/Under (da extra_markets, linea canonica 2.5, match per key non label)
  const em = r.enrichment?.extra_markets ?? [];
  const over = em.find((x) => x.key === "over_2_5");
  const under = em.find((x) => x.key === "under_2_5");
  if (over || under) {
    const chips: MarketChip[] = [];
    if (over) chips.push({ id: "gol-over", market: "Over/Under", selection: "Over 2.5", prob: over.p, odds: over.market_odds, hasValue: (over.edge ?? 0) > 0, recommended: (over.p ?? 0) >= (under?.p ?? 0) });
    if (under) chips.push({ id: "gol-under", market: "Over/Under", selection: "Under 2.5", prob: under.p, odds: under.market_odds, hasValue: (under.edge ?? 0) > 0, recommended: (under.p ?? 0) > (over?.p ?? 0) });
    const eg = r.enrichment?.goals_summary?.expected_goals;
    groups.push({ key: "gol", title: "Gol", chips, note: eg != null ? `Gol attesi dal modello: ~${eg.toFixed(1)}` : undefined });
  }
  return groups;
}
