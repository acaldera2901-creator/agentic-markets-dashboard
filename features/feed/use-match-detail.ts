"use client";

import { useEffect, useState } from "react";
import type { RichPrediction } from "./market-groups";

export type MatchDetailResult = { detail: RichPrediction | null; loading: boolean; error: string | null };

export function useMatchDetail(externalEventId: string | null): MatchDetailResult {
  const [detail, setDetail] = useState<RichPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(externalEventId != null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externalEventId == null) { setDetail(null); setLoading(false); setError(null); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/predictions", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { predictions?: RichPrediction[] };
        if (!alive) return;
        setDetail((json.predictions ?? []).find((p) => p.match_id === externalEventId) ?? null);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setDetail(null);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [externalEventId]);

  return { detail, loading, error };
}
