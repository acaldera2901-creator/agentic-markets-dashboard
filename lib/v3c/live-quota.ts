// lib/v3c/live-quota.ts (#V3C-LIVE2) — how often a paid/limited live source may
// be read. Pure: the clock is passed in, the state lives in the instance.
//
// Four brakes, checked in this order:
//   1. backoff   — after an error: 30 s, 60 s, 120 s … up to 10 min;
//   2. reserve   — the provider's own «remaining» header is at or under the
//                  reserve: the quota is shared with the pipeline (settlement,
//                  odds), so live reads stop first;
//   3. budget    — this instance's daily budget (UTC day) is spent;
//   4. interval  — the same resource was read less than `minIntervalMs` ago:
//                  not a degradation, the caller serves its own cached copy.
//
// Limit (stated, not hidden): serverless instances do not share this state, so
// N warm instances can each spend `dailyBudget`. The `reserve` brake reads the
// provider's header, which IS shared, and is the real ceiling. Upgrade path: a
// shared counter (KV/Redis) if the instances ever multiply.

export type LiveBudgetConfig = {
  /** quota units per UTC day this instance may spend on live reads */
  dailyBudget: number;
  /** minimum gap between two reads of the same resource */
  minIntervalMs: number;
  /** stop when the provider says this many units (or fewer) are left */
  reserve: number;
};

export type BudgetVerdict = "ok" | "interval" | "budget" | "reserve" | "backoff";

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 600_000;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export class LiveBudget {
  private day = "";
  private used = 0;
  private lastAt = new Map<string, number>();
  private failures = 0;
  private backoffUntil = 0;
  private remaining: number | null = null;

  constructor(readonly cfg: LiveBudgetConfig) {}

  private roll(now: number) {
    const d = utcDay(now);
    if (d !== this.day) {
      this.day = d;
      this.used = 0;
    }
  }

  /** May `resource` be read now? (`cost` = the units this read will spend.) */
  check(now: number, resource = "*", cost = 1): BudgetVerdict {
    this.roll(now);
    if (now < this.backoffUntil) return "backoff";
    if (this.remaining != null && this.remaining - cost < this.cfg.reserve) return "reserve";
    if (this.used + cost > this.cfg.dailyBudget) return "budget";
    const last = this.lastAt.get(resource);
    if (last != null && now - last < this.cfg.minIntervalMs) return "interval";
    return "ok";
  }

  /** After a read: what it cost and what the provider says is left. */
  record(now: number, r: { ok: boolean; resource?: string; cost?: number; remaining?: number | null; retryAfterMs?: number | null }) {
    this.roll(now);
    this.used += r.cost ?? 1;
    this.lastAt.set(r.resource ?? "*", now);
    if (r.remaining != null && Number.isFinite(r.remaining)) this.remaining = r.remaining;
    if (r.ok) {
      this.failures = 0;
      this.backoffUntil = 0;
      return;
    }
    this.failures += 1;
    const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (this.failures - 1));
    this.backoffUntil = now + Math.max(wait, r.retryAfterMs ?? 0);
  }

  snapshot() {
    return { used: this.used, budget: this.cfg.dailyBudget, remaining: this.remaining, failures: this.failures, backoffUntil: this.backoffUntil };
  }
}

/** An integer env knob, or the default when unset/invalid. */
export function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

/** The provider's «remaining» header as a number, or null. */
export function headerInt(h: Headers, name: string): number | null {
  const raw = h.get(name);
  if (raw == null || raw.trim() === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
}
