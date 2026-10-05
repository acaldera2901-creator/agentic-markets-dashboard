// Read-only SQL for the v3 endpoints. SELECT only — nothing here writes.
// dbQueryStrict: a DB error must surface as a 5xx, never as an empty record.
import { dbQueryStrict } from "@/lib/db";
import { FOOTBALL_LEDGER_MODEL_VERSION, FOOTBALL_LEDGER_SOURCE_TABLE } from "@/lib/pick-ledger-mirror";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import type { BoardSourceRow, PartnerPriceRow, TennisSourceRow } from "./board";
import type { AhHistoryRow } from "./line-movement";
import type { SealedFootballRow } from "./record";
import type { SealedTennisRow } from "./calibration";
import type { SealedDayRow } from "./yesterday";

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/**
 * Published tennis rows of the same window (F3). `tennis_predictions.scheduled_at`
 * is a naive UTC timestamp (#TENNIS-TZ-FIX): it is marked as UTC here, once.
 * Seal time: the first pick_ledger row of the match, any model version.
 */
export async function fetchBoardTennisSources(): Promise<TennisSourceRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `WITH u AS (
       SELECT source_id
         FROM unified_predictions
        WHERE starts_at > NOW() - interval '150 minutes'
          AND starts_at < NOW() + ($1 || ' days')::interval
          AND expires_at > NOW() - interval '150 minutes'
          AND published_at IS NOT NULL
          AND is_historical = FALSE
          AND is_demo = FALSE
          AND source_table = 'tennis_predictions'
     )
     SELECT DISTINCT ON (tp.match_id)
            tp.match_id AS id, tp.tournament, tp.surface, tp.scheduled_at,
            tp.player1, tp.player2, tp.p1, tp.p2, tp.odds_p1, tp.odds_p2,
            tp.model_version, tp.computed_at,
            (SELECT min(l.captured_at) FROM pick_ledger l
              WHERE l.source_table = 'tennis_predictions' AND l.source_id = tp.match_id) AS sealed_at
       FROM tennis_predictions tp
       JOIN u ON u.source_id = tp.match_id
      WHERE tp.p1 IS NOT NULL AND tp.p2 IS NOT NULL
        AND upper(btrim(tp.player1)) NOT IN ('TBD', '')
        AND upper(btrim(tp.player2)) NOT IN ('TBD', '')
      ORDER BY tp.match_id, tp.computed_at DESC NULLS LAST`,
    [PREDICTION_WINDOW_DAYS],
  );
  const utc = (s: string) => (/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
  return rows
    .map((r) => ({
      id: String(r.id),
      tournament: (r.tournament as string) ?? null,
      surface: (r.surface as string) ?? null,
      scheduled: utc(String(r.scheduled_at)),
      player1: String(r.player1),
      player2: String(r.player2),
      p1: Number(r.p1),
      p2: Number(r.p2),
      odds_p1: num(r.odds_p1),
      odds_p2: num(r.odds_p2),
      model_version: (r.model_version as string) ?? null,
      computed_at: r.computed_at ? String(r.computed_at) : null,
      sealed_at: (r.sealed_at as string) ?? null,
    }))
    .sort((a, b) => Date.parse(a.scheduled) - Date.parse(b.scheduled) || a.id.localeCompare(b.id));
}

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
      GROUP BY 1 ORDER BY 1`,
    [PREDICTION_WINDOW_DAYS, FOOTBALL_LEDGER_SOURCE_TABLE],
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

/** Sealed, settled tennis picks (non-backfill): p = sealed probability of the pick. */
export async function fetchSealedTennis(): Promise<SealedTennisRow[]> {
  const rows = await dbQueryStrict<Record<string, unknown>>(
    `SELECT l.model_version, l.confidence AS p, s.result
       FROM pick_ledger l
       JOIN pick_settlement_current s
         ON s.source_table = l.source_table
        AND s.source_id = l.source_id
        AND s.model_version = l.model_version
      WHERE l.sport = 'tennis'
        AND l.is_backfill = FALSE
        AND s.result IN ('won', 'lost')
        AND l.confidence IS NOT NULL`,
  );
  return rows.map((r) => ({ model_version: String(r.model_version), p: Number(r.p), result: String(r.result) }));
}
