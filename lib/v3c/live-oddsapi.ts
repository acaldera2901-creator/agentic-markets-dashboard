// lib/v3c/live-oddsapi.ts (#V3C-LIVE2) — PURE parsing of The Odds API
// `GET /v4/sports/{sport_key}/scores` (licensed, already paid: 5M credits/month).
// Score and completed flag only: no minute, no events, no extra time / penalties
// distinction — those fields stay null, never guessed.
//
// Shape recorded 07/10 (tests/fixtures/live-sources/oddsapi-scores-*.json).
// Its event id IS our id for every `oddsapi:<id>` row (171 of 213 football rows
// on the 07/10 board), so most rows match exactly, without names.
import type { SourceSoccerEvent } from "./live-apifootball";

type RawScoreEvent = {
  id?: unknown;
  commence_time?: string;
  completed?: boolean;
  home_team?: string;
  away_team?: string;
  scores?: { name?: string; score?: unknown }[] | null;
  last_update?: string | null;
};

function goals(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 ? raw : null;
  return typeof raw === "string" && /^\d{1,3}$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

/**
 * completed → final · scores present → live (no minute) · not started yet → pre.
 * Kicked off but no scores yet: the source does not know → dropped (no item, not a 0–0).
 */
export function parseOddsApiScores(data: unknown, now: Date): SourceSoccerEvent[] {
  if (!Array.isArray(data)) return [];
  const out: SourceSoccerEvent[] = [];
  for (const raw of data as RawScoreEvent[]) {
    const id = raw?.id;
    const ko = raw?.commence_time;
    const hn = raw?.home_team;
    const an = raw?.away_team;
    if (id == null || !ko || !hn || !an || !Number.isFinite(Date.parse(ko))) continue;
    const scores = Array.isArray(raw.scores) ? raw.scores : null;
    // the scores are keyed by NAME: only the two names of this very event count
    const h = scores ? goals(scores.find((s) => s?.name === hn)?.score) : null;
    const a = scores ? goals(scores.find((s) => s?.name === an)?.score) : null;
    const hasScore = h != null && a != null;
    let state: SourceSoccerEvent["state"];
    if (raw.completed === true) {
      if (!hasScore) continue; // completed without a readable score: nothing to show
      state = "final";
    } else if (hasScore) state = "live";
    else if (Date.parse(ko) > now.getTime()) state = "pre";
    else continue;
    out.push({
      id: String(id),
      kickoff: ko,
      home: hn,
      away: an,
      state,
      final_kind: null,
      minute: null,
      homeScore: state === "pre" ? null : h,
      awayScore: state === "pre" ? null : a,
      pens: null,
      events: [],
      updatedAt: raw.last_update && Number.isFinite(Date.parse(raw.last_update)) ? new Date(raw.last_update).toISOString() : null,
    });
  }
  return out;
}
