"use client";

import { useEffect, useState } from "react";

export type LbRow = {
  rank: number;
  name: string;
  points: number;
  betsWon: number;
  betsTotal: number;
  hitRate: string | number | null;
  sport: string | null;
};

export type UseLeaderboardResult = {
  entries: LbRow[];
  systemHitRate: string | null;
  systemSettled: number;
  pointsPerWin: number;
  loading: boolean;
  error: string | null;
};

type LeaderboardApiEntry = {
  rank: number;
  name: string;
  points: number;
  bets_won: number;
  bets_total: number;
  hit_rate: string | number | null;
  sport: string | null;
};

type LeaderboardApiResponse = {
  leaderboard: LeaderboardApiEntry[];
  system_hit_rate: string | null;
  system_settled: number;
  points_per_win: number;
};

// CRITICAL FTC: mappare SOLO i campi elencati — mai pnl/profit/roi/stake.
function toLbRow(e: LeaderboardApiEntry): LbRow {
  return {
    rank: e.rank,
    name: e.name,
    points: e.points,
    betsWon: e.bets_won,
    betsTotal: e.bets_total,
    hitRate: e.hit_rate ?? null,
    sport: e.sport ?? null,
  };
}

export function useLeaderboard(): UseLeaderboardResult {
  const [entries, setEntries] = useState<LbRow[]>([]);
  const [systemHitRate, setSystemHitRate] = useState<string | null>(null);
  const [systemSettled, setSystemSettled] = useState(0);
  const [pointsPerWin, setPointsPerWin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/leaderboard", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LeaderboardApiResponse;
        if (!alive) return;
        setEntries((json.leaderboard ?? []).map(toLbRow));
        setSystemHitRate(json.system_hit_rate ?? null);
        setSystemSettled(json.system_settled ?? 0);
        setPointsPerWin(json.points_per_win ?? 0);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setEntries([]);
        setSystemHitRate(null);
        setSystemSettled(0);
        setPointsPerWin(0);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { entries, systemHitRate, systemSettled, pointsPerWin, loading, error };
}
