import { createClient } from '@supabase/supabase-js';
import type { MatchResultCardData, Sport, Outcome } from '../cards/match-result.ts';

export interface SettledPick {
  sport: string;
  home_team: string;
  away_team: string;
  final_score: string | null;
  pick: string | null;      // 'HOME' | 'DRAW' | 'AWAY' (football) or player name (tennis)
  confidence: number;       // 0..1
  result: string;           // won | lost | void | unresolved
}

export interface UnifiedSettledRow {
  sport: string;
  home_team: string | null;
  away_team: string | null;
  player_one: string | null;
  player_two: string | null;
  pick: string | null;
  confidence_score: number | null;
  result: string;
  notes: string | Record<string, unknown> | null;
}

function extractFinalScore(notes: UnifiedSettledRow['notes']): string | null {
  if (!notes) return null;
  try {
    const n = typeof notes === 'string' ? JSON.parse(notes) : notes;
    const fs = (n as any)?.final_score;
    return typeof fs === 'string' && fs.trim() ? fs : null;
  } catch {
    return null;
  }
}

function normalizeConfidence(c: number | null): number {
  if (c == null) return 0;
  return c > 1 ? c / 100 : c; // unified stores 0–100; the card expects 0..1
}

export function unifiedRowToSettledPick(row: UnifiedSettledRow): SettledPick {
  return {
    sport: row.sport,
    home_team: row.home_team ?? row.player_one ?? '',
    away_team: row.away_team ?? row.player_two ?? '',
    final_score: extractFinalScore(row.notes),
    pick: row.pick,
    confidence: normalizeConfidence(row.confidence_score),
    result: row.result,
  };
}

function normalizeSport(s: string): Sport {
  return s.toLowerCase().includes('tennis') ? 'tennis' : 'football';
}

function normalizeOutcome(result: string): Outcome {
  const r = result.toLowerCase();
  if (r === 'won') return 'won';
  if (r === 'lost') return 'lost';
  throw new Error(`pick-adapter: esito non renderizzabile "${result}" (atteso won/lost)`);
}

function humanizePick(pick: string | null, sport: Sport): string {
  if (!pick) throw new Error('pick-adapter: pick assente (nessuna direzione dichiarata)');
  if (sport === 'football') {
    const map: Record<string, string> = {
      HOME: '1 (vittoria casa)',
      DRAW: 'X (pareggio)',
      AWAY: '2 (vittoria trasferta)',
    };
    return map[pick.toUpperCase()] ?? pick;
  }
  return pick; // tennis: nome giocatore
}

export function settledPickToCardData(row: SettledPick): MatchResultCardData {
  if (!row.final_score) throw new Error('pick-adapter: punteggio (final_score) mancante');
  const sport = normalizeSport(row.sport);
  return {
    sport,
    home: row.home_team,
    away: row.away_team,
    score: row.final_score,
    pick: humanizePick(row.pick, sport),
    probability: row.confidence,
    outcome: normalizeOutcome(row.result),
  };
}

export async function fetchLatestSettledPicks(limit = 5): Promise<SettledPick[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('pick-adapter: SUPABASE_URL / key mancanti in env');
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('unified_predictions')
    .select('sport, home_team, away_team, player_one, player_two, pick, confidence_score, result, settled_at, notes')
    .in('result', ['won', 'lost'])
    .order('settled_at', { ascending: false })
    .limit(Math.max(limit * 8, 40)); // overfetch: many settled rows lack final_score
  if (error) throw new Error(`pick-adapter: query fallita — ${error.message}`);
  return (data ?? [])
    .map((r) => unifiedRowToSettledPick(r as UnifiedSettledRow))
    .filter((p) => !!p.final_score)
    .slice(0, limit);
}
