// Short per-key server cache for the LIVE reads (#GROWTH-V5).
//
// Measured 06/10: one live page load = 20 read-only transactions of ~100 ms,
// latency-bound, queued on a small pool. Within the TTL the same window is
// served from memory: the page still shows the instant of the read (meta.asOf),
// so "ultimo aggiornamento" never lies. Each window is its own key. Concurrent
// misses share one read. A failed load, or one the caller marks as not
// cacheable (a query in ERRORE), is never kept: the next request reads again.
// Per server instance only: a new serverless instance starts empty.

export interface TtlCache<K, V> {
  get(key: K, load: () => Promise<V>): Promise<V>;
}

export function ttlCache<K, V>(ttlMs: number, cacheable: (v: V) => boolean = () => true, now: () => number = Date.now): TtlCache<K, V> {
  const entries = new Map<K, { at: number; value: Promise<V> }>();
  return {
    get(key, load) {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const at = now();
      const value = load().then(
        (v) => {
          if (!cacheable(v) && entries.get(key)?.value === value) entries.delete(key);
          return v;
        },
        (e) => {
          if (entries.get(key)?.value === value) entries.delete(key);
          throw e;
        },
      );
      entries.set(key, { at, value });
      return value;
    },
  };
}
