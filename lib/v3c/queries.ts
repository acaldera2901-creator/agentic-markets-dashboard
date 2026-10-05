// Read-only SQL for the v3 endpoints. SELECT only — nothing here writes.
// dbQueryStrict: a DB error must surface as a 5xx, never as an empty record.
import { dbQueryStrict } from "@/lib/db";
import { FOOTBALL_LEDGER_MODEL_VERSION, FOOTBALL_LEDGER_SOURCE_TABLE } from "@/lib/pick-ledger-mirror";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import { PARTNER_MARKET_MODEL } from "@/lib/partner-market";
import type { BoardSourceRow, PartnerPriceRow } from "./board";
import type { AhHistoryRow } from "./line-movement";
import type { SealedFootballRow } from "./record";
import { TENNIS_LEDGER_SOURCE_TABLE, type SealedTennisRow, type TennisBoardSourceRow } from "./tennis";
import type { SealedDayRow } from "./yesterday";

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/**
 * Sealed picks (non-backfill) that kicked off in [from, to) with their current
 * settlement, both sports. Football is restricted to the ledger model of the
 * public record so «yesterday» and the record count the same population.
 */
export async function fetchSealedDay(fromIso: string, toIso: string): Promise<SealedDayRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT l.sport, l.home_team, l.away_team, l.competition, l.league, l.pick, l.confidence,
            l.p_home, l.p_draw, l.p_away, l.commence_time, l.captured_at, l.is_paper,
            s.result, s.outcome, s.final_score
       FROM pick_ledger l
       JOIN pick_settlement_current s
         ON s.source_table = l.source_table
        AND s.source_id = l.source_id
        AND s.model_version = l.model_version
      WHERE l.is_backfill = FALSE
        AND l.commence_time >= $1::timestamptz
        AND l.commence_time <  $2::timestamptz
        AND ((l.sport = 'football' AND l.source_table = $3 AND l.model_version = $4) OR l.sport = 'tennis')
      ORDER BY l.commence_time, l.home_team`,
    [fromIso, toIso, FOOTBALL_LEDGER_SOURCE_TABLE, FOOTBALL_LEDGER_MODEL_VERSION],
  );
  return rows.map((r) => ({
    sport: String(r.sport) === "tennis" ? "tennis" : "football",
    home: String(r.home_team ?? ""),
    away: String(r.away_team ?? ""),
    competition: (r.competition as string) ?? (r.league as string) ?? null,
    pick: (r.pick as string) ?? null,
    confidence: num(r.confidence),
    p_home: num(r.p_home),
    p_draw: num(r.p_draw),
    p_away: num(r.p_away),
    commence_time: String(r.commence_time),
    captured_at: String(r.captured_at),
    is_paper: r.is_paper === true,
    result: String(r.result ?? ""),
    outcome: (r.outcome as string) ?? null,
    final_score: (r.final_score as string) ?? null,
  }));
}

/**
 * Published football matches of the live board window (same conditions as
 * /api/v2/predictions), with the LATEST prediction_log row (market odds, raw
 * model, served estimate) and the seal time from pick_ledger.
 */
export async function fetchBoardSources(): Promise<BoardSourceRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `WITH u AS (
       SELECT source_id, competition, league
         FROM unified_predictions
        WHERE starts_at > NOW() - interval '150 minutes'
          AND starts_at < NOW() + ($1 || ' days')::interval
          AND expires_at > NOW() - interval '150 minutes'
          AND published_at IS NOT NULL
          AND is_historical = FALSE
          AND is_demo = FALSE
          AND source_table = $2
     )
     SELECT DISTINCT ON (pl.match_id)
            pl.match_id AS id, u.league, u.competition,
            pl.kickoff, pl.home_team AS home, pl.away_team AS away, pl.computed_at,
            pl.odds_home, pl.odds_draw, pl.odds_away,
            pl.model_p_home, pl.model_p_draw, pl.model_p_away,
            pl.p_home, pl.p_draw, pl.p_away,
            (SELECT l.captured_at FROM pick_ledger l
              WHERE l.source_table = $2 AND l.source_id = pl.match_id AND l.model_version = $3) AS sealed_at
       FROM prediction_log pl
       JOIN u ON u.source_id = pl.match_id
      ORDER BY pl.match_id, pl.computed_at DESC`,
    [PREDICTION_WINDOW_DAYS, FOOTBALL_LEDGER_SOURCE_TABLE, FOOTBALL_LEDGER_MODEL_VERSION],
  );
  return rows
    .map((r) => ({
      id: String(r.id),
      league: (r.league as string) ?? null,
      competition: (r.competition as string) ?? null,
      kickoff: String(r.kickoff),
      home: String(r.home),
      away: String(r.away),
      computed_at: String(r.computed_at),
      odds_home: num(r.odds_home),
      odds_draw: num(r.odds_draw),
      odds_away: num(r.odds_away),
      model_p_home: num(r.model_p_home),
      model_p_draw: num(r.model_p_draw),
      model_p_away: num(r.model_p_away),
      p_home: Number(r.p_home),
      p_draw: Number(r.p_draw),
      p_away: Number(r.p_away),
      sealed_at: (r.sealed_at as string) ?? null,
    }))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));
}

/** Published rows of the same window that the v3 board does not carry yet. */
export async function fetchBoardExcluded(): Promise<{ source_table: string; n: number }[]> {
  const rows = await dbQueryStrict<{ source_table: string; n: number }>(
    `SELECT coalesce(source_table, 'null') AS source_table, count(*)::int AS n
       FROM unified_predictions
      WHERE starts_at > NOW() - interval '150 minutes'
        AND starts_at < NOW() + ($1 || ' days')::interval
        AND expires_at > NOW() - interval '150 minutes'
        AND published_at IS NOT NULL
        AND is_historical = FALSE
        AND is_demo = FALSE
        AND source_table IS DISTINCT FROM $2
        AND source_table IS DISTINCT FROM $3
      GROUP BY 1 ORDER BY 1`,
    [PREDICTION_WINDOW_DAYS, FOOTBALL_LEDGER_SOURCE_TABLE, TENNIS_LEDGER_SOURCE_TABLE],
  );
  return rows.map((r) => ({ source_table: r.source_table, n: Number(r.n) }));
}

function inList(keys: string[], offset: number): string {
  return keys.map((_, i) => `$${offset + i + 1}`).join(",");
}

/** Latest price per (team_pair_key, bookmaker) captured in the last `maxAgeMin`. */
export async function fetchLatestPartnerPrices(keys: string[], maxAgeMin: number): Promise<PartnerPriceRow[]> {
  if (!keys.length) return [];
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT DISTINCT ON (team_pair_key, bookmaker)
            team_pair_key, bookmaker, home_name, away_name,
            odds_home, odds_draw, odds_away, captured_at
       FROM partner_price_history
      WHERE captured_at > NOW() - ($1 || ' minutes')::interval
        AND team_pair_key IN (${inList(keys, 1)})
      ORDER BY team_pair_key, bookmaker, captured_at DESC`,
    [maxAgeMin, ...keys],
  );
  return rows.map(toPartnerRow);
}

function toPartnerRow(r: Record<string, unknown>): PartnerPriceRow {
  return {
    team_pair_key: String(r.team_pair_key),
    bookmaker: String(r.bookmaker),
    home_name: String(r.home_name ?? ""),
    away_name: String(r.away_name ?? ""),
    odds_home: num(r.odds_home),
    odds_draw: num(r.odds_draw),
    odds_away: num(r.odds_away),
    captured_at: String(r.captured_at),
  };
}

/** The fixture of a match id (latest prediction_log row). */
export async function fetchMatchFixture(id: string): Promise<{ home: string; away: string; kickoff: string } | null> {
  const rows = await dbQueryStrict<{ home: string; away: string; kickoff: string }>(
    `SELECT home_team AS home, away_team AS away, kickoff
       FROM prediction_log WHERE match_id = $1
      ORDER BY computed_at DESC LIMIT 1`,
    [id],
  );
  return rows[0] ? { home: rows[0].home, away: rows[0].away, kickoff: String(rows[0].kickoff) } : null;
}

export async function fetchPartnerHistory(key: string): Promise<PartnerPriceRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT team_pair_key, bookmaker, home_name, away_name, odds_home, odds_draw, odds_away, captured_at
       FROM partner_price_history WHERE team_pair_key = $1 ORDER BY captured_at`,
    [key],
  );
  return rows.map(toPartnerRow);
}

export async function fetchAhHistory(key: string): Promise<AhHistoryRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT source, home_name, away_name, ah_line, ah_odds_home, ah_odds_away, captured_at
       FROM ah_odds_history WHERE team_pair_key = $1 ORDER BY captured_at`,
    [key],
  );
  return rows.map((r) => ({
    source: String(r.source),
    home_name: String(r.home_name ?? ""),
    away_name: String(r.away_name ?? ""),
    ah_line: num(r.ah_line),
    ah_odds_home: num(r.ah_odds_home),
    ah_odds_away: num(r.ah_odds_away),
    captured_at: String(r.captured_at),
  }));
}

/**
 * Every sealed football row (non-backfill) with its current settlement and the
 * market at seal time. The market is taken from the prediction_log row whose
 * SERVED probabilities equal the sealed ones (|diff| < 1e-9) and that was
 * computed at or before the seal — i.e. the exact numbers that were sealed.
 */
export const SEALED_FOOTBALL_SQL = `
  SELECT l.source_id, l.captured_at, l.commence_time, l.is_paper,
         l.p_home, l.p_draw, l.p_away,
         s.result, s.outcome,
         m.market_p_home, m.market_p_draw, m.market_p_away
    FROM pick_ledger l
    LEFT JOIN pick_settlement_current s
           ON s.source_table = l.source_table
          AND s.source_id = l.source_id
          AND s.model_version = l.model_version
    LEFT JOIN LATERAL (
          SELECT pl.market_p_home, pl.market_p_draw, pl.market_p_away
            FROM prediction_log pl
           WHERE pl.match_id = l.source_id
             AND pl.computed_at <= l.captured_at
             AND abs(pl.p_home - l.p_home) < 1e-9
             AND abs(pl.p_draw - l.p_draw) < 1e-9
             AND abs(pl.p_away - l.p_away) < 1e-9
           ORDER BY pl.computed_at DESC
           LIMIT 1) m ON TRUE
   WHERE l.source_table = $1
     AND l.model_version = $2
     AND l.is_backfill = FALSE
     AND l.p_home IS NOT NULL`;

export async function fetchSealedFootball(): Promise<SealedFootballRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(SEALED_FOOTBALL_SQL, [
    FOOTBALL_LEDGER_SOURCE_TABLE,
    FOOTBALL_LEDGER_MODEL_VERSION,
  ]);
  return rows.map((r) => ({
    source_id: String(r.source_id),
    captured_at: String(r.captured_at),
    commence_time: String(r.commence_time),
    is_paper: r.is_paper === true,
    p_home: Number(r.p_home),
    p_draw: Number(r.p_draw),
    p_away: Number(r.p_away),
    result: (r.result as string) ?? null,
    outcome: (r.outcome as string) ?? null,
    market_p_home: num(r.market_p_home),
    market_p_draw: num(r.market_p_draw),
    market_p_away: num(r.market_p_away),
  }));
}

/**
 * Every sealed tennis row (non-backfill) with its current settlement (null =
 * none yet). p = sealed probability of the picked player.
 */
export async function fetchSealedTennis(): Promise<SealedTennisRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT l.source_id, l.model_version, l.home_team, l.away_team, l.pick,
            l.confidence AS p, l.odds, l.signal_type, l.captured_at, l.commence_time, s.result
       FROM pick_ledger l
       LEFT JOIN pick_settlement_current s
         ON s.source_table = l.source_table
        AND s.source_id = l.source_id
        AND s.model_version = l.model_version
      WHERE l.sport = 'tennis'
        AND l.is_backfill = FALSE
        AND l.confidence IS NOT NULL`,
  );
  return rows.map((r) => ({
    source_id: String(r.source_id),
    model_version: String(r.model_version),
    home_team: String(r.home_team ?? ""),
    away_team: String(r.away_team ?? ""),
    pick: String(r.pick ?? ""),
    p: Number(r.p),
    result: (r.result as string) ?? null,
    odds: num(r.odds),
    signal_type: (r.signal_type as string) ?? null,
    captured_at: String(r.captured_at),
    commence_time: String(r.commence_time),
  }));
}

/** Every partner_price_history capture of `keys`, grouped by key, oldest first. */
export async function fetchPartnerHistoryByKeys(keys: string[]): Promise<Map<string, PartnerPriceRow[]>> {
  const out = new Map<string, PartnerPriceRow[]>();
  const unique = [...new Set(keys)];
  // chunks keep the IN list (and the statement) small
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const rows = await dbQueryStrict<Record<string, unknown>>(
      `SELECT team_pair_key, bookmaker, home_name, away_name, odds_home, odds_draw, odds_away, captured_at
         FROM partner_price_history
        WHERE team_pair_key IN (${inList(chunk, 0)})
        ORDER BY team_pair_key, captured_at`,
      chunk,
    );
    for (const r of rows.map(toPartnerRow)) {
      const list = out.get(r.team_pair_key) ?? [];
      list.push(r);
      out.set(r.team_pair_key, list);
    }
  }
  return out;
}

/**
 * Published tennis matches of the live board window (same filters as the
 * football board), with the stored tennis_predictions row, the raw Elo of the
 * latest prediction_log shadow snapshot (Elo rows only — partner-market rows
 * have no model) and the seal. tennis_predictions timestamps are stored
 * WITHOUT time zone in UTC, hence AT TIME ZONE 'UTC'.
 */
export async function fetchTennisBoardSources(): Promise<TennisBoardSourceRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `WITH u AS (
       SELECT source_id, pick
         FROM unified_predictions
        WHERE starts_at > NOW() - interval '150 minutes'
          AND starts_at < NOW() + ($1 || ' days')::interval
          AND expires_at > NOW() - interval '150 minutes'
          AND published_at IS NOT NULL
          AND is_historical = FALSE
          AND is_demo = FALSE
          AND source_table = $2
     )
     SELECT tp.match_id AS id, tp.tournament,
            (tp.scheduled_at AT TIME ZONE 'UTC') AS kickoff,
            tp.player1, tp.player2, tp.p1, tp.p2, tp.odds_p1, tp.odds_p2, tp.edge,
            tp.model_version, (tp.computed_at AT TIME ZONE 'UTC') AS computed_at,
            tp.feature_snapshot->>'odds_bookmaker' AS odds_bookmaker,
            u.pick AS surfaced_pick,
            sh.model_p_home AS model_p1, sh.model_p_away AS model_p2, sh.computed_at AS model_as_of,
            l.captured_at AS sealed_at, l.p_home AS sealed_p1, l.p_away AS sealed_p2,
            l.odds AS sealed_odds, l.signal_type AS sealed_signal_type
       FROM u
       JOIN tennis_predictions tp ON tp.match_id = u.source_id
       LEFT JOIN LATERAL (
            SELECT pl.model_p_home, pl.model_p_away, pl.computed_at
              FROM prediction_log pl
             WHERE pl.match_id = tp.match_id
             ORDER BY pl.computed_at DESC
             LIMIT 1) sh ON tp.model_version <> $3
       LEFT JOIN pick_ledger l
              ON l.source_table = $2 AND l.source_id = tp.match_id AND l.model_version = tp.model_version`,
    [PREDICTION_WINDOW_DAYS, TENNIS_LEDGER_SOURCE_TABLE, PARTNER_MARKET_MODEL],
  );
  return rows
    .map((r) => ({
      id: String(r.id),
      tournament: (r.tournament as string) ?? null,
      kickoff: String(r.kickoff),
      player1: String(r.player1),
      player2: String(r.player2),
      p1: Number(r.p1),
      p2: Number(r.p2),
      odds_p1: num(r.odds_p1),
      odds_p2: num(r.odds_p2),
      edge: num(r.edge),
      model_version: String(r.model_version),
      computed_at: String(r.computed_at),
      odds_bookmaker: (r.odds_bookmaker as string) ?? null,
      surfaced_pick: (r.surfaced_pick as string) ?? null,
      model_p1: num(r.model_p1),
      model_p2: num(r.model_p2),
      model_as_of: (r.model_as_of as string) ?? null,
      sealed_at: (r.sealed_at as string) ?? null,
      sealed_p1: num(r.sealed_p1),
      sealed_p2: num(r.sealed_p2),
      sealed_odds: num(r.sealed_odds),
      sealed_signal_type: (r.sealed_signal_type as string) ?? null,
    }))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id.localeCompare(b.id));
}

/** The fixture of a tennis match id (tennis_predictions). */
export async function fetchTennisFixture(id: string): Promise<{ home: string; away: string; kickoff: string } | null> {
  const rows = await dbQueryStrict<{ home: string; away: string; kickoff: string }>(
    `SELECT player1 AS home, player2 AS away, (scheduled_at AT TIME ZONE 'UTC') AS kickoff
       FROM tennis_predictions WHERE match_id = $1
      ORDER BY computed_at DESC LIMIT 1`,
    [id],
  );
  return rows[0] && rows[0].kickoff ? { home: rows[0].home, away: rows[0].away, kickoff: String(rows[0].kickoff) } : null;
}
