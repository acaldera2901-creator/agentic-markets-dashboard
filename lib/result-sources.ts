// #GATE-1001 — the declared result source of every served sport/league.
// The list itself lives in data/result_sources.json (read by the Python writer
// and by the tower check too): to add a sport or league, declare it there.
import table from "@/data/result_sources.json";

export type ResultSourceTable = {
  sources: Record<string, Record<string, string[]>>;
  debt: { owner: string; due: string; leagues: string[] };
};

export const RESULT_SOURCES: ResultSourceTable = table;

/** Returned for a served league declared as debt (no source, kept on purpose
 *  until debt.due so it does not vanish from the board). */
export const RESULT_SOURCE_DEBT = "declared_debt";

/** Comma-joined sources, RESULT_SOURCE_DEBT, or null = no source (reject).
 *  Tennis is keyed "*": every tennis row goes through the same resolvers,
 *  whatever the tournament name. */
export function resultSourceFor(
  sport: string,
  league: string | null,
  t: ResultSourceTable = RESULT_SOURCES,
): string | null {
  // Codes are matched like the Python classifiers do (.upper()).
  const code = (league ?? "").trim().toUpperCase();
  const bySport = t.sources[sport];
  const sources = bySport?.[code] ?? bySport?.["*"];
  if (sources && sources.length > 0) return sources.join(",");
  if (t.debt.leagues.includes(`${sport}:${code}`)) return RESULT_SOURCE_DEBT;
  return null;
}
