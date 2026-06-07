"use client";

// World Cup track record — hit-rate only (no money fields, product line).
// /api/v2/history already enforces is_historical + is_demo filters and
// computes honest stats server-side.
import { useEffect, useState } from "react";
import { WC_T, type WcLang } from "@/lib/world-cup-i18n";

type Stats = {
  total: number; won: number; lost: number;
  void: number; pending: number; win_rate: string | null;
};

export default function TrackRecordStrip({ lang = "it" }: { lang?: WcLang }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const t = WC_T[lang];

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
        {t.trackRecordEmpty}
      </div>
    );
  }

  return (
    <div className="wc-track-strip">
      <div className="glass-card wc-stat"><strong>{stats.total}</strong><small>{t.statSettled}</small></div>
      <div className="glass-card wc-stat"><strong>{stats.won}</strong><small>{t.statWon}</small></div>
      <div className="glass-card wc-stat"><strong>{stats.lost}</strong><small>{t.statLost}</small></div>
      <div className="glass-card wc-stat"><strong>{stats.win_rate ?? "—"}</strong><small>{t.statHitRate}</small></div>
    </div>
  );
}
