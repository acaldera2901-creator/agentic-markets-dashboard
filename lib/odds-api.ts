const BASE = "https://api.the-odds-api.com/v4";

const SPORT_KEYS: Record<string, string> = {
  PL: "soccer_epl",
  SA: "soccer_italy_serie_a",
  PD: "soccer_spain_la_liga",
  BL1: "soccer_germany_bundesliga",
  FL1: "soccer_france_ligue_one",
  CL: "soccer_uefa_champs_league",
  EL: "soccer_uefa_europa_league",
  WC: "soccer_fifa_world_cup", // parity with core/odds_api_client.py (#018)
  // Summer-calendar leagues (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12).
  // Keys verified active on /v4/sports 2026-06-12. Parity with
  // core/odds_api_client.py SPORT_KEYS — keep in sync.
  ELI: "soccer_norway_eliteserien",
  ALL: "soccer_sweden_allsvenskan",
  VEI: "soccer_finland_veikkausliiga",
  LOI: "soccer_league_of_ireland",
  CSL: "soccer_china_superleague",
};

export function normName(name: string): string {
  return name
    .replace(/\b(FC|CF|SC|AC|AS|SV|SS|US|SSC|AFC|Calcio)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface ExtraOdds {
  over_1_5: number | null;
  over_2_5: number | null;
  over_3_5: number | null;
  btts_yes:  number | null;
  btts_no:   number | null;
  double_1x: number | null;
  double_x2: number | null;
  double_12: number | null;
}

export interface OddsResult {
  homeNorm: string;
  awayNorm: string;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  bookmaker: string;
  margin: number;
  extra: ExtraOdds;
}

type OddsEvent = {
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
};

function bestPrice(events: OddsEvent[], homeNorm: string, awayNorm: string, marketKey: string, outcomeName: string, point?: number): number | null {
  let best: number | null = null;
  for (const ev of events) {
    // Both teams must match — the old AND-of-inequalities only skipped when BOTH
    // differed, so an event sharing one team could supply side-market prices off
    // the wrong fixture (#BUGCHECK-0617).
    if (!(normName(ev.home_team) === homeNorm && normName(ev.away_team) === awayNorm)) continue;
    for (const bm of ev.bookmakers) {
      for (const mkt of bm.markets) {
        if (mkt.key !== marketKey) continue;
        for (const out of mkt.outcomes) {
          if (out.name !== outcomeName) continue;
          if (point !== undefined && out.point !== point) continue;
          if (best === null || out.price > best) best = out.price;
        }
      }
    }
  }
  return best;
}

export async function fetchOdds(league: string): Promise<OddsResult[]> {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = SPORT_KEYS[league];
  if (!apiKey || !sportKey) return [];

  try {
    const url = new URL(`${BASE}/sports/${sportKey}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu,uk");
    url.searchParams.set("markets", "h2h,totals,btts,double_chance");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("bookmakers", "betfair,pinnacle,bet365");

    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) return [];

    const events = await r.json() as OddsEvent[];

    const results: OddsResult[] = [];
    for (const ev of events) {
      let best1X2: { oh: number; od: number; oa: number; bm: string; margin: number } | null = null;
      let bestMargin = Infinity;

      for (const bm of ev.bookmakers) {
        for (const mkt of bm.markets) {
          if (mkt.key !== "h2h") continue;
          const o: Record<string, number> = {};
          for (const out of mkt.outcomes) o[out.name] = out.price;
          const oh = o[ev.home_team] ?? 0;
          const od = o["Draw"] ?? 0;
          const oa = o[ev.away_team] ?? 0;
          if (!oh || !od || !oa) continue;
          const margin = 1 / oh + 1 / od + 1 / oa - 1;
          if (margin < bestMargin) {
            bestMargin = margin;
            best1X2 = { oh, od, oa, bm: bm.key, margin: Math.round(margin * 10000) / 10000 };
          }
        }
      }

      if (!best1X2) continue;
      const hN = normName(ev.home_team);
      const aN = normName(ev.away_team);

      const extra: ExtraOdds = {
        over_1_5: bestPrice([ev], hN, aN, "totals", "Over", 1.5),
        over_2_5: bestPrice([ev], hN, aN, "totals", "Over", 2.5),
        over_3_5: bestPrice([ev], hN, aN, "totals", "Over", 3.5),
        btts_yes:  bestPrice([ev], hN, aN, "btts", "Yes"),
        btts_no:   bestPrice([ev], hN, aN, "btts", "No"),
        double_1x: bestPrice([ev], hN, aN, "double_chance", "1X"),
        double_x2: bestPrice([ev], hN, aN, "double_chance", "X2"),
        double_12: bestPrice([ev], hN, aN, "double_chance", "12"),
      };

      results.push({
        homeNorm: hN,
        awayNorm: aN,
        oddsHome: best1X2.oh,
        oddsDraw: best1X2.od,
        oddsAway: best1X2.oa,
        bookmaker: best1X2.bm,
        margin: best1X2.margin,
        extra,
      });
    }
    return results;
  } catch {
    return [];
  }
}
