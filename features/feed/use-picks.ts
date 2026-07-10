"use client";

import { useEffect, useState } from "react";
import { toPickCardVM, type PickCardVM, type ProjectedPrediction } from "./pick-view-model";

export type UsePicksResult = { picks: PickCardVM[]; loading: boolean; error: string | null };

export function usePicks(): UsePicksResult {
  const [picks, setPicks] = useState<PickCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/predictions", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { predictions: ProjectedPrediction[] };
        if (!alive) return;
        setPicks((json.predictions ?? []).map(toPickCardVM));
        setError(null);
      } catch (e) {
        if (!alive) return;
        setPicks([]);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { picks, loading, error };
}
