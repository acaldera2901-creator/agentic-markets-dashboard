// lib/soft-lookup.ts — shared soft-markets lookup (#SOFT-MARKETS)
// Encapsulates the batch query + exact-key + fuzzy-fallback lookup for the
// soft_predictions table (corners/cards/fouls). Used by both the main
// /api/predictions route and the WC /api/v2/predictions route so the matching
// logic stays DRY and consistent.

import { dbQuery } from "@/lib/db";
import { normName } from "@/lib/odds-api";
import { matchModelTeam } from "@/lib/summer-leagues";

export type SoftEntry = {
  expected: number;
  main_line: number;
  p_over: number;
  is_generic: boolean;
};

export type SoftMarkets = {
  corners?: SoftEntry;
  cards?: SoftEntry;
  fouls?: SoftEntry;
};

type SoftRow = {
  match_key: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  market: string;
  expected: number;
  main_line: number;
  p_over: number;
  is_generic: boolean;
};

type SoftLookupFn = (home: string, away: string, kickoff: string) => SoftMarkets | null;

// Queries soft_predictions (rows for the next ~150 min back through future),
// builds a map + fuzzy list, and returns a lookup function. Fail-soft: if the
// table is absent or the query throws, returns a lookup that always returns null.
export async function buildSoftLookup(): Promise<SoftLookupFn> {
  let byKey: Record<string, SoftMarkets> = {};
  const fuzzy: Array<{ home: string; away: string; date: string; markets: SoftMarkets }> = [];

  try {
    const rows = await dbQuery<SoftRow>(
      `SELECT match_key, home_team, away_team, kickoff, market, expected, main_line, p_over, is_generic
       FROM soft_predictions
       WHERE kickoff > NOW() - interval '150 minutes'`
    );

    const byKeyMeta: Record<string, { home: string; away: string; date: string }> = {};

    for (const row of rows) {
      if (!byKey[row.match_key]) byKey[row.match_key] = {};
      byKeyMeta[row.match_key] = {
        home: row.home_team,
        away: row.away_team,
        date: String(row.kickoff).slice(0, 10),
      };
      const entry: SoftEntry = {
        expected: row.expected,
        main_line: row.main_line,
        p_over: row.p_over,
        is_generic: row.is_generic,
      };
      if (row.market === "corners") byKey[row.match_key].corners = entry;
      else if (row.market === "cards") byKey[row.match_key].cards = entry;
      else if (row.market === "fouls") byKey[row.match_key].fouls = entry;
    }

    for (const [key, meta] of Object.entries(byKeyMeta)) {
      fuzzy.push({ home: meta.home, away: meta.away, date: meta.date, markets: byKey[key] });
    }
  } catch {
    // Fail-soft: table not yet available or DB error — return no-op lookup.
    byKey = {};
  }

  return function lookupSoft(home: string, away: string, kickoff: string): SoftMarkets | null {
    const key = `${normName(home)}|${normName(away)}|${kickoff.slice(0, 10)}`;
    const exact = byKey[key];
    if (exact && Object.keys(exact).length > 0) return exact;
    const date = kickoff.slice(0, 10);
    for (const s of fuzzy) {
      if (s.date !== date) continue;
      if (
        matchModelTeam(home, [s.home]) &&
        matchModelTeam(away, [s.away]) &&
        Object.keys(s.markets).length > 0
      ) {
        return s.markets;
      }
    }
    return null;
  };
}
