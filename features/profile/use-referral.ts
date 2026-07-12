"use client";

import { useCallback, useEffect, useState } from "react";

export type ClaimResult = { ok: boolean; error?: string };

export type UseReferralResult = {
  code: string | null;
  signups: number;
  paid: number;
  loading: boolean;
  error: string | null;
  claim: (code: string) => Promise<ClaimResult>;
};

type ReferralStats = { code: string; signups: number; paid: number };

export function useReferral(): UseReferralResult {
  const [code, setCode] = useState<string | null>(null);
  const [signups, setSignups] = useState(0);
  const [paid, setPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (alive: () => boolean) => {
    try {
      const res = await fetch("/api/referral/stats", { credentials: "include" });
      if (res.status === 403) {
        if (!alive()) return;
        setCode(null);
        setSignups(0);
        setPaid(0);
        setError(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ReferralStats;
      if (!alive()) return;
      setCode(json.code);
      setSignups(json.signups);
      setPaid(json.paid);
      setError(null);
    } catch (e) {
      if (!alive()) return;
      setCode(null);
      setSignups(0);
      setPaid(0);
      setError(e instanceof Error ? e.message : "Errore nel caricamento");
    } finally {
      if (alive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchStats(() => alive);
    return () => { alive = false; };
  }, [fetchStats]);

  const claim = useCallback(async (claimCode: string): Promise<ClaimResult> => {
    try {
      const res = await fetch("/api/referral/claim", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: claimCode }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        return { ok: false, error: (json as { error?: string }).error ?? "Errore nella richiesta" };
      }
      await fetchStats(() => true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Errore nella richiesta" };
    }
  }, [fetchStats]);

  return { code, signups, paid, loading, error, claim };
}
