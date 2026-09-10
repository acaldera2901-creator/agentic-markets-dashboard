"use client";

import { useEffect, useState } from "react";
import type { Segment } from "@/lib/track-record-history";

export type YearStats = {
  won?: number;
  lost?: number;
  win_rate?: string;
  // popolati dal backfill backend (Parte 2); assenti finché non atterra → UI degrada a "—"
  roi?: string;
  market_roi?: string;
  clv?: string;
  beat_close?: string;
  // #SETTLE-0909 — il contorno che rende la percentuale dichiarabile: su quante
  // partite è calcolata, quanta parte delle pick mostrate abbiamo verificato, e
  // quanto è solida. Opzionali: una risposta servita da un deploy precedente non
  // li ha, e la UI deve degradare invece di scrivere "undefined".
  n?: number;
  coverage?: number | null;
  surfaced_total?: number;
  unverified_excluded?: number;
  interval_95?: { low: number; high: number } | null;
} | null;

export type YearData = { stats: YearStats; segments?: Segment[] };

// #HISTORY-TRIM-0626: legge /api/v2/history sul track record live (nessun filtro
// anno) + aggregati (additivi). Se il backend non fornisce ancora gli aggregati,
// segments resta undefined (degrada pulito).
export function useYearData(aggregate: string): YearData | null {
  const [data, setData] = useState<YearData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/v2/history?aggregate=${aggregate}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData({ stats: d.stats ?? null, segments: d.segments });
      })
      .catch(() => {
        if (alive) setData({ stats: null });
      });
    return () => {
      alive = false;
    };
  }, [aggregate]);
  return data;
}
