"use client";

import { useEffect, useState } from "react";
import type { Segment, Week } from "@/lib/track-record-history";

export type YearStats = {
  won?: number;
  lost?: number;
  win_rate?: string;
  // popolati dal backfill backend (Parte 2); assenti finché non atterra → UI degrada a "—"
  roi?: string;
  market_roi?: string;
  clv?: string;
  beat_close?: string;
} | null;

export type YearData = { stats: YearStats; segments?: Segment[]; weeks?: Week[] };

// Legge /api/v2/history per anno + aggregati (additivi). Se il backend non
// fornisce ancora gli aggregati, segments/weeks restano undefined (degrada pulito).
export function useYearData(year: "2026" | "2025", aggregate: string): YearData | null {
  const [data, setData] = useState<YearData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/v2/history?year=${year}&aggregate=${aggregate}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData({ stats: d.stats ?? null, segments: d.segments, weeks: d.weeks });
      })
      .catch(() => {
        if (alive) setData({ stats: null });
      });
    return () => {
      alive = false;
    };
  }, [year, aggregate]);
  return data;
}
