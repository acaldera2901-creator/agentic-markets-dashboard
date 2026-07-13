import { NextRequest, NextResponse } from "next/server";
import { fetchAllTodayMatches } from "@/lib/football-data";
import { SUMMER_LEAGUES, fetchSummerResults } from "@/lib/summer-leagues";
import { dbQuery, getSupabaseAdminClient } from "@/lib/db";
import { settlePredictionLog } from "@/lib/prediction-log";
import { verifyBearer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// #SETTLE-1 (APPROVE Andrea 2026-06-07): resilient settlement cron.
//
// Before this cron the public track record depended entirely on the Python
// ResultSettlementAgent running on a local machine, and prediction_log (the
// calibration table) settled only when an authenticated user happened to open
// /api/live. This endpoint replicates the exact settlement semantics of
// agents/result_settlement.py::_unified_settlement_cycle server-side, every
// 30 minutes, independent of both. The Python agents stay on — every write
// here is idempotent (only rows with result IS NULL are touched), so the two
// paths coexist safely.
//
// Four error-isolated steps:
//   A. live scores -> match_predictions (same SQL as /api/live)
//   B. finished matches -> settlePredictionLog (calibration snapshots)
//   C. finished matches -> unified_predictions football (public history)
//   D. tennis_predictions.winner -> unified_predictions tennis (backstop for
//      the Python sync; no external fetch — winner is already in our DB)

interface SettleReport {
  scores_updated: number;
  log_settled: number;
  unified_football_settled: number;
  unified_tennis_settled: number;
  voided_stale: number;
  errors: string[];
  ran_at: string;
}

function footballOutcome(
  pick: string,
  market: string | null,
  homeGoals: number,
  awayGoals: number
): "won" | "lost" | "void" {
  // Exact parity with agents/result_settlement.py: unknown market/pick is
  // settled as void rather than guessed.
  if ((market ?? "1X2") !== "1X2" || !["home", "draw", "away"].includes(pick)) {
    return "void";
  }
  const actual = homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "home" : "away";
  return pick === actual ? "won" : "lost";
}

function mergeFinalScore(notes: unknown, finalScore: string): string {
  // Parity with core/supabase_client.py::settle_unified_prediction — notes is
  // a JSON text column; merge, never clobber, fall back to a fresh object.
  let obj: Record<string, unknown> = {};
  if (typeof notes === "string" && notes.trim()) {
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) obj = parsed;
    } catch {
      obj = {};
    }
  } else if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    obj = notes as Record<string, unknown>;
  }
  obj.final_score = finalScore;
  return JSON.stringify(obj);
}

export async function GET(req: NextRequest) {
  // Default-deny + constant-time: a missing CRON_SECRET must never leave the
  // trigger open, and the compare must not leak timing.
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report: SettleReport = {
    scores_updated: 0,
    log_settled: 0,
    unified_football_settled: 0,
    unified_tennis_settled: 0,
    voided_stale: 0,
    errors: [],
    ran_at: new Date().toISOString(),
  };
  const sb = getSupabaseAdminClient();
  const nowIso = () => new Date().toISOString();

  // ── A+B. Live scores + prediction_log ─────────────────────────────────────
  const finished = new Map<string, { homeGoals: number; awayGoals: number }>();
  try {
    const matches = await fetchAllTodayMatches();
    for (const m of matches) {
      if (m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "FINISHED") {
        await dbQuery(
          `UPDATE match_predictions
             SET home_score = $1, away_score = $2, match_status = $3
           WHERE match_id = $4`,
          [m.homeGoals, m.awayGoals, m.status, m.id]
        ).then(() => { report.scores_updated += 1; })
          .catch((e: unknown) => report.errors.push(`scores:${m.id}:${String(e)}`));
      }
      if (m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null) {
        await settlePredictionLog(m.id, m.homeGoals, m.awayGoals);
        report.log_settled += 1;
        finished.set(m.id, { homeGoals: m.homeGoals, awayGoals: m.awayGoals });
      }
    }
  } catch (e) {
    report.errors.push(`fetch_matches:${String(e)}`);
  }

  // ── A2. Summer leagues (#SUMMER-LEAGUES-1): fd.org does not cover them, so
  // finished results come from ESPN scoreboards (espn:* match ids) and The
  // Odds API /scores (oddsapi:* ids) via lib/summer-leagues. Same idempotent
  // UPDATE + settlement semantics as step A.
  for (const code of Object.keys(SUMMER_LEAGUES)) {
    try {
      const results = await fetchSummerResults(code);
      for (const m of results) {
        await dbQuery(
          `UPDATE match_predictions
             SET home_score = $1, away_score = $2, match_status = 'FINISHED'
           WHERE match_id = $3 AND (match_status IS DISTINCT FROM 'FINISHED')`,
          [m.homeGoals, m.awayGoals, m.id]
        ).then(() => { report.scores_updated += 1; })
          .catch((e: unknown) => report.errors.push(`summer_scores:${m.id}:${String(e)}`));
        await settlePredictionLog(m.id, m.homeGoals, m.awayGoals);
        finished.set(m.id, { homeGoals: m.homeGoals, awayGoals: m.awayGoals });
      }
    } catch (e) {
      report.errors.push(`summer:${code}:${String(e)}`);
    }
  }

  // ── C. unified_predictions football ───────────────────────────────────────
  if (sb && finished.size > 0) {
    try {
      const { data: rows, error } = await sb
        .from("unified_predictions")
        .select("id, external_event_id, pick, market, notes")
        .eq("sport", "football")
        .eq("is_historical", false)
        .is("result", null)
        .in("external_event_id", [...finished.keys()]);
      if (error) throw error;
      for (const row of rows ?? []) {
        const m = finished.get(String(row.external_event_id));
        if (!m) continue;
        const outcome = footballOutcome(
          String(row.pick ?? "").toLowerCase(),
          row.market ? String(row.market) : null,
          m.homeGoals,
          m.awayGoals
        );
        const { error: upErr } = await sb
          .from("unified_predictions")
          .update({
            result: outcome,
            status: "settled",
            is_historical: true,
            settled_at: nowIso(),
            updated_at: nowIso(),
            notes: mergeFinalScore(row.notes, `${m.homeGoals}-${m.awayGoals}`),
          })
          .eq("id", row.id)
          .is("result", null); // idempotency vs the Python agent
        if (upErr) report.errors.push(`unified_football:${row.id}:${upErr.message}`);
        else report.unified_football_settled += 1;
      }
    } catch (e) {
      report.errors.push(`unified_football:${String(e)}`);
    }
  }

  // ── D. unified_predictions tennis (backstop from tennis_predictions) ─────
  if (sb) {
    try {
      const cutoff = new Date(Date.now() - 115 * 60 * 1000).toISOString();
      const { data: trows, error } = await sb
        .from("unified_predictions")
        .select("id, source_id, pick")
        .eq("sport", "tennis")
        .eq("source_table", "tennis_predictions")
        .eq("is_historical", false)
        .is("result", null)
        .lt("starts_at", cutoff)
        .limit(500);
      if (error) throw error;
      const ids = (trows ?? []).map((r) => String(r.source_id)).filter(Boolean);
      if (ids.length > 0) {
        const { data: winners, error: wErr } = await sb
          .from("tennis_predictions")
          .select("match_id, winner")
          .in("match_id", ids)
          .not("winner", "is", null);
        if (wErr) throw wErr;
        const winnerByMatch = new Map(
          (winners ?? []).map((w) => [String(w.match_id), String(w.winner)])
        );
        for (const row of trows ?? []) {
          const winner = winnerByMatch.get(String(row.source_id));
          if (!winner) continue; // not settled upstream yet — next run
          const outcome = winner === String(row.pick) ? "won" : "lost";
          const { error: upErr } = await sb
            .from("unified_predictions")
            .update({
              result: outcome,
              status: "settled",
              is_historical: true,
              settled_at: nowIso(),
              updated_at: nowIso(),
            })
            .eq("id", row.id)
            .is("result", null);
          if (upErr) report.errors.push(`unified_tennis:${row.id}:${upErr.message}`);
          else report.unified_tennis_settled += 1;
        }
      }
    } catch (e) {
      report.errors.push(`unified_tennis:${String(e)}`);
    }
  }

  // ── E. void football stale (#GOLIVE-QW-B) ────────────────────────────────
  // Step C settles only football rows whose fixture actually FINISHED. A match
  // that is postponed / abandoned / never returns a score would otherwise keep
  // result NULL forever: it silently drops off the live board (kickoff long
  // past) but never enters the public history — an orphan. Past a 48h grace we
  // flag it 'unresolved' + is_historical = TRUE, the exact value the tennis
  // backstop uses for "we never fetched a result" (settle_unified_tennis /
  // #TENNIS-VOID-FIX-1). 'unresolved' is deliberately NOT 'void': /api/v2/history
  // excludes it ("result IS DISTINCT FROM 'unresolved'"), so a match we never
  // scored does not fake a refund/void in the track record. Idempotent via
  // .is("result", null).
  if (sb) {
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await sb
        .from("unified_predictions")
        .select("id")
        .eq("sport", "football")
        .eq("is_historical", false)
        .is("result", null)
        .lt("starts_at", cutoff)
        .limit(500);
      if (error) throw error;
      for (const row of rows ?? []) {
        const { error: upErr } = await sb
          .from("unified_predictions")
          .update({
            result: "unresolved",
            status: "settled",
            is_historical: true,
            settled_at: nowIso(),
            updated_at: nowIso(),
          })
          .eq("id", row.id)
          .is("result", null); // idempotency vs a concurrent settle
        if (upErr) report.errors.push(`void_stale:${row.id}:${upErr.message}`);
        else report.voided_stale += 1;
      }
    } catch (e) {
      report.errors.push(`void_stale:${String(e)}`);
    }
  }

  return NextResponse.json(report);
}
