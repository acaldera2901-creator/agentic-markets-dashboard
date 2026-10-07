"use client";
// components/v3c/live/useLiveScores.ts (#V3C-LIVESCORES) — polls GET /api/v3/live
// while there is something live to show AND the tab is visible:
//   * every 45 s; on errors 90 s, 180 s, then every 5 min;
//   * hidden tab → the timer stops and the request in flight is aborted;
//     visible again → one read at once if the last is older than 45 s;
//   * two errors in a row → the scores are dropped («score n/a»): a stale
//     score shown as live would be a made-up number.
import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import type { V3LiveItem, V3LiveResponse } from "@/lib/v3c/live-contract";
import type { V3cLiveCopy } from "@/lib/v3c/live-copy";
import { LIVE_POLL_MS, announcements, nextDelay } from "@/lib/v3c/live-view";

export type LiveFeed = {
  items: Record<string, V3LiveItem>;
  /** at least one answer (or two failures) arrived: «no item» now means «the source has nothing» */
  loaded: boolean;
  failed: boolean;
  /** generated_at of the data shown */
  updatedAt: string | null;
  /** the last thing worth announcing (aria-live polite) */
  announce: string;
};

const EMPTY: LiveFeed = { items: {}, loaded: false, failed: false, updatedAt: null, announce: "" };

export function useLiveScores(enabled: boolean, names: (id: string) => [string, string] | null, copy: V3cLiveCopy): LiveFeed {
  const [feed, setFeed] = useState<LiveFeed>(EMPTY);

  const onData = useEffectEvent((prev: Record<string, V3LiveItem> | null, data: V3LiveResponse) => {
    const said = announcements(prev, data.items, names, copy);
    setFeed((f) => ({ items: data.items, loaded: true, failed: false, updatedAt: data.generated_at, announce: said.length ? said.join(". ") : f.announce }));
  });
  const onFail = useEffectEvent((errors: number) => {
    if (errors >= 2) setFeed((f) => ({ ...f, items: {}, loaded: true, failed: true, updatedAt: null }));
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let ctrl: AbortController | null = null;
    let errors = 0;
    let lastAt = 0;
    let stopped = false;
    let prev: Record<string, V3LiveItem> | null = null;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, Math.max(0, ms));
    };
    async function run() {
      if (stopped || document.visibilityState !== "visible") return;
      const mine = new AbortController();
      ctrl = mine;
      try {
        const r = await fetch("/api/v3/live", { signal: mine.signal, headers: { accept: "application/json" } });
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as V3LiveResponse;
        if (stopped || mine.signal.aborted) return;
        if (data?.contract !== "v3.live.1" || !data.items) throw new Error("contract");
        errors = 0;
        lastAt = Date.now();
        onData(prev, data);
        prev = data.items;
      } catch {
        if (stopped || mine.signal.aborted) return;
        errors += 1;
        onFail(errors);
      }
      if (!stopped) schedule(nextDelay(errors));
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const age = Date.now() - lastAt;
        schedule(age >= LIVE_POLL_MS ? 0 : LIVE_POLL_MS - age);
      } else {
        window.clearTimeout(timer);
        ctrl?.abort();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule(0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      ctrl?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return enabled ? feed : EMPTY;
}

/** The clock at the minute (store = time: no setState in an effect). `frozen` = the page's own time (/dev/ds). */
export function useMinuteNow(initialIso: string, frozen = false): Date {
  const serverMin = Math.floor(Date.parse(initialIso) / 60_000);
  const min = useSyncExternalStore(
    (cb) => {
      if (frozen) return () => {};
      const id = window.setInterval(cb, 30_000);
      return () => window.clearInterval(id);
    },
    () => (frozen ? serverMin : Math.floor(Date.now() / 60_000)),
    () => serverMin,
  );
  return useMemo(() => new Date(min * 60_000), [min]);
}
