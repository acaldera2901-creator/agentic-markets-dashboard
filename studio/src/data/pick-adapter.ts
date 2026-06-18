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
    .from('pick_settlement')
    .select('result, final_score, pick_ledger!inner(sport, home_team, away_team, pick, confidence)')
    .in('result', ['won', 'lost'])
    .order('settled_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`pick-adapter: query fallita — ${error.message}`);
  return (data ?? []).map((r: any) => ({
    sport: r.pick_ledger.sport,
    home_team: r.pick_ledger.home_team,
    away_team: r.pick_ledger.away_team,
    final_score: r.final_score,
    pick: r.pick_ledger.pick,
    confidence: r.pick_ledger.confidence,
    result: r.result,
  }));
}
