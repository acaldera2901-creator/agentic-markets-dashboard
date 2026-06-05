"use client";

// World Cup track record — hit-rate only (no money fields, product line).
// /api/v2/history already enforces is_historical + is_demo filters and
// computes honest stats server-side.
import { useEffect, useState } from "react";

type Stats = {
  total: number; won: number; lost: number;
  void: number; pending: number; win_rate: string | null;
};

export default function TrackRecordStrip() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v2/history?competition=World Cup&limit=200")
      .then((r) => r.json())
      .then((d) => { if (alive) setStats(d.stats || null); })
      .catch(() => { if (alive) setStats(null); });
    return () => { alive = false; };
  }, []);

  if (!stats || !stats.total) {
    return (
      <div className="book-empty">
        The World Cup track record starts with the first settled match — every
        result lands here, wins and losses alike.
      </div>
    );
  }

  return (
    <div className="wc-track-strip">
      <div className="glass-card wc-stat"><strong>{stats.total}</strong><small>settled</small></div>
      <div className="glass-card wc-stat"><strong>{stats.won}</strong><small>won</small></div>
      <div className="glass-card wc-stat"><strong>{stats.lost}</strong><small>lost</small></div>
      <div className="glass-card wc-stat"><strong>{stats.win_rate ?? "—"}</strong><small>hit rate</small></div>
    </div>
  );
}
