import { tennisHistoryProbabilitySource } from './tennis-probability';
import { WEEKLY_PICK_MIN_LEG_PROB, type WeeklyPickLeg } from './weekly-pick';

export type WeeklyCandidateRow = {
  id: string; sport: string | null; home_team: string | null; away_team: string | null;
  pick: string | null; notes: string | null; starts_at: string;
  model_version: string; source_table: string; source_id: string;
  sealed_pick: string | null; sealed_p_home: number | null; sealed_p_draw: number | null;
  sealed_p_away: number | null; sealed_at: string; sealed_starts_at: string;
  sealed_home: string | null; sealed_away: string | null;
};

/** Only the pre-match sealed distribution can supply a model case probability.
 * Confidence scores and model-version labels are not probability provenance. */
export function weeklyCandidate(r: WeeklyCandidateRow, now: Date): WeeklyPickLeg | null {
  const kickoff = Date.parse(r.starts_at);
  const captured = Date.parse(r.sealed_at);
  if (!r.sealed_pick || r.pick !== r.sealed_pick || !r.home_team || !r.away_team
      || r.home_team !== r.sealed_home || r.away_team !== r.sealed_away
      || !Number.isFinite(kickoff) || kickoff <= now.getTime()
      || Date.parse(r.sealed_starts_at) !== kickoff || !Number.isFinite(captured)
      || captured > now.getTime() || captured >= kickoff) return null;
  const [h, d, a] = [r.sealed_p_home, r.sealed_p_draw, r.sealed_p_away];
  const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  if (!valid(h) || !valid(a)) return null;
  let prob: number | null = null;
  let market: string | null = null;
  if (r.sport === 'football' && r.source_table === 'match_predictions' && r.model_version === 'football-v4-xg-model') {
    if (!valid(d) || Math.abs(h + d + a - 1) > .00011) return null;
    prob = r.pick === 'HOME' ? h : r.pick === 'AWAY' ? a : r.pick === 'DRAW' ? d : null;
    market = r.pick === 'HOME' ? r.home_team : r.pick === 'AWAY' ? r.away_team : 'Draw';
  } else if (r.sport === 'tennis' && tennisHistoryProbabilitySource(r.model_version, r.notes) === 'model') {
    if (Math.abs(h + a - 1) > .00011) return null;
    // A later publication cannot attach its provenance to a different old seal.
    const meta = JSON.parse(r.notes!).probability;
    const selected = r.pick === r.home_team ? meta.published_p1 : meta.published_p2;
    const rounded = Math.round(selected * 100) / 100;
    const expectedHome = r.pick === r.home_team ? rounded : 1 - rounded;
    if (Math.abs(expectedHome - h) > 1e-10 || Math.abs(1 - expectedHome - a) > 1e-10) return null;
    prob = r.pick === r.home_team ? h : r.pick === r.away_team ? a : null;
    market = r.pick;
  }
  if (prob === null || !market || prob < WEEKLY_PICK_MIN_LEG_PROB) return null;
  return { id: `wp_${r.id}`, label: `${r.home_team} vs ${r.away_team}`, market,
    sport: r.sport!, prob, startsAt: new Date(kickoff).toISOString(),
    snapshot: { sourceTable: r.source_table, sourceId: r.source_id, modelVersion: r.model_version,
      pick: r.sealed_pick, capturedAt: r.sealed_at, probabilitySource: 'model' } };
}
