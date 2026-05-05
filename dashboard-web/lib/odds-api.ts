const BASE = "https://api.the-odds-api.com/v4";

const SPORT_KEYS: Record<string, string> = {
  PL: "soccer_epl",
  SA: "soccer_italy_serie_a",
  PD: "soccer_spain_la_liga",
  BL1: "soccer_germany_bundesliga",
  FL1: "soccer_france_ligue_one",
  CL: "soccer_uefa_champs_league",
  EL: "soccer_uefa_europa_league",
};

export function normName(name: string): string {
  return name
    .replace(/\b(FC|CF|SC|AC|AS|SV|SS|US|SSC|AFC|Calcio)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface OddsResult {
  homeNorm: string;
  awayNorm: string;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  bookmaker: string;
  margin: number;
}

export async function fetchOdds(league: string): Promise<OddsResult[]> {
  const apiKey = process.env.ODDS_API_KEY;
  const sportKey = SPORT_KEYS[league];
  if (!apiKey || !sportKey) return [];

  try {
    const url = new URL(`${BASE}/sports/${sportKey}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu,uk");
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("bookmakers", "betfair,pinnacle,bet365");

    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) return [];

    const events = await r.json() as Array<{
      home_team: string;
      away_team: string;
      bookmakers: Array<{
        key: string;
        markets: Array<{
          key: string;
          outcomes: Array<{ name: string; price: number }>;
        }>;
      }>;
    }>;

    const results: OddsResult[] = [];
    for (const ev of events) {
      let best: OddsResult | null = null;
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
            best = {
              homeNorm: normName(ev.home_team),
              awayNorm: normName(ev.away_team),
              oddsHome: oh,
              oddsDraw: od,
              oddsAway: oa,
              bookmaker: bm.key,
              margin: Math.round(margin * 10000) / 10000,
            };
          }
        }
      }
      if (best) results.push(best);
    }
    return results;
  } catch {
    return [];
  }
}
