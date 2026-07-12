"use client";

import { useEffect, useState } from "react";
import { humanizePick } from "@/features/feed/pick-view-model";

export type TrackRow = {
  id: string;
  sport: string;
  competition: string;
  homeTeam: string | null;
  awayTeam: string | null;
  kickoff: string;
  finalScore: string | null;
  result: "won" | "lost" | "void" | null;
  locked: boolean;
  decision: string | null;
};

export type TrackStats = {
  total: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  winRate: string | null;
};

export type UseTrackRecordResult = {
  history: TrackRow[];
  stats: TrackStats | null;
  loading: boolean;
  error: string | null;
};

type HistoryApiRow = {
  id: string;
  sport?: string | null;
  competition?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  starts_at?: string | null;
  final_score?: string | null;
  result?: string | null;
  locked?: boolean;
  pick?: string | null;
  market?: string | null;
};

type HistoryApiStats = {
  total: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  win_rate: string | null;
};

// "unresolved" e qualsiasi altro valore non riconosciuto → null (non ancora settled).
function normalizeResult(result: string | null | undefined): "won" | "lost" | "void" | null {
  return result === "won" || result === "lost" || result === "void" ? result : null;
}

function toTrackRow(row: HistoryApiRow): TrackRow {
  // decision: solo se la riga è sbloccata e porta un pick (reveal fields presenti).
  const decision = row.pick
    ? humanizePick({
        market: row.market ?? null,
        pick: row.pick ?? null,
        home_team: row.home_team ?? null,
        away_team: row.away_team ?? null,
      }) || null
    : null;

  return {
    id: row.id,
    sport: row.sport ?? "",
    competition: row.competition ?? "",
    homeTeam: row.home_team ?? null,
    awayTeam: row.away_team ?? null,
    kickoff: row.starts_at ?? "",
    finalScore: row.final_score ?? null,
    result: normalizeResult(row.result),
    locked: row.locked === true,
    decision,
  };
}

export function useTrackRecord(opts?: { sport?: string }): UseTrackRecordResult {
  const [history, setHistory] = useState<TrackRow[]>([]);
  const [stats, setStats] = useState<TrackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sport = opts?.sport;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = sport ? `/api/v2/history?sport=${encodeURIComponent(sport)}` : "/api/v2/history";
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { history: HistoryApiRow[]; stats: HistoryApiStats };
        if (!alive) return;
        setHistory((json.history ?? []).map(toTrackRow));
        setStats(
          json.stats
            ? {
                total: json.stats.total,
                won: json.stats.won,
                lost: json.stats.lost,
                void: json.stats.void,
                pending: json.stats.pending,
                winRate: json.stats.win_rate ?? null,
              }
            : null
        );
        setError(null);
      } catch (e) {
        if (!alive) return;
        setHistory([]);
        setStats(null);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [sport]);

  return { history, stats, loading, error };
}
