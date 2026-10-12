// Growth dashboard — pure logic, no DB access, no auth, no layout.
// Ported from PR #516 (lib/growth/kpi.ts): keep the two in sync until one wins.
//
// The page exists so that Steve (Growth/Data) can read the numbers without
// asking anyone. The non-negotiable rule: a KPI we do NOT measure must never
// render as 0 or "—". Every tile carries an explicit status:
//   LIVE   — counted directly from the DB, the number means what the label says
//   PROXY  — counted from the DB, but it approximates the KPI (caveat explains how)
//   MANCA  — no data source exists; the tile says what is needed and who unblocks it
//   ERRORE — the read failed; we show the failure, never a fallback number

export type KpiStatus = "LIVE" | "PROXY" | "MANCA" | "ERRORE";

export type GrowthWindow = "today" | "7d" | "30d";

export const WINDOWS: { key: GrowthWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

export function parseWindow(raw: string | string[] | undefined): GrowthWindow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "today" || v === "7d" || v === "30d" ? v : "7d";
}

// SQL expression for the start of the window. Returned from a closed set of
// constants — the user-supplied value never reaches the SQL string.
// "Today" is the calendar day in Europe/Rome (the team's day), not the last 24h.
export function windowStartSql(w: GrowthWindow): string {
  switch (w) {
    case "today":
      return "(date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome')";
    case "7d":
      return "(now() - interval '7 days')";
    case "30d":
      return "(now() - interval '30 days')";
  }
}

export function windowLabel(w: GrowthWindow): string {
  return WINDOWS.find((x) => x.key === w)!.label;
}

// Same set as app/api/cron/subscriptions/route.ts (CANALI_A_PAGAMENTO): the
// plan_source values that mean "someone paid". Everything else on a paid plan
// (manual, referral, NULL legacy) is a comp/team/gift account.
export const PAID_CHANNELS = ["shopify", "shopify_oneoff", "paygate", "paypal", "stripe"] as const;

export interface PlanRow {
  plan: string | null;
  plan_source: string | null;
  expired: boolean;
  /** Our own / test account (content/internal-accounts.json). */
  internal: boolean;
  /** External paid-channel plan with no paid order recorded anywhere (same file). */
  no_payment: boolean;
  n: number;
}

export interface PayingSplit {
  /**
   * «External paying customers»: base/premium from a paid channel, not expired,
   * not an internal/test account, with a paid order recorded.
   */
  external: number;
  /** Same as external but no paid order recorded anywhere: shown apart, never counted as paying. */
  externalNoPayment: number;
  /** Internal/test accounts holding base/premium/admin_full (any source). */
  internalWithPlan: number;
  /** …of which admin_full. */
  internalAdminFull: number;
  /** External base/premium granted manually / by referral / with no recorded source. */
  comp: number;
  /** External, paid channel, plan_expires_at already passed (cron not yet run). */
  expiredNotSwept: number;
  /** Every base/premium row, internal and comps included. */
  inclComp: number;
  free: number;
  /** …of which internal/test accounts. */
  freeInternal: number;
  /** admin_full in all (by the rules, every one is internal). */
  team: number;
}

export function splitPaying(rows: PlanRow[]): PayingSplit {
  const out: PayingSplit = { external: 0, externalNoPayment: 0, internalWithPlan: 0, internalAdminFull: 0, comp: 0, expiredNotSwept: 0, inclComp: 0, free: 0, freeInternal: 0, team: 0 };
  const paid = new Set<string>(PAID_CHANNELS);
  for (const r of rows) {
    const n = Number(r.n) || 0;
    const onPlan = r.plan === "base" || r.plan === "premium";
    if (r.plan === "free") {
      out.free += n;
      if (r.internal) out.freeInternal += n;
    } else if (r.plan === "admin_full") {
      out.team += n;
      if (r.internal) {
        out.internalWithPlan += n;
        out.internalAdminFull += n;
      }
    }
    if (!onPlan) continue;
    out.inclComp += n;
    if (r.internal) out.internalWithPlan += n;
    else if (!paid.has(r.plan_source ?? "")) out.comp += n;
    else if (r.expired) out.expiredNotSwept += n;
    else if (r.no_payment) out.externalNoPayment += n;
    else out.external += n;
  }
  return out;
}

/** Below this many external paid orders a share (e.g. annual plans) is n/a: the sample says nothing. */
export const MIN_ORDERS_FOR_SHARE = 5;

/** Ratio as a fraction, or null when the denominator is 0 — never a fake 0%. */
export function ratio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

export function formatPct(r: number | null, digits = 1): string | null {
  return r === null ? null : `${(r * 100).toFixed(digits)}%`;
}

/**
 * A part-of-whole percentage that can never read above 100%: when num > den the
 * two counters disagree (incomplete tracking), so the text says so instead of a
 * number. Denominator 0 → "n/a".
 */
export function formatShare(num: number, den: number, overReason: string, digits = 0): string {
  const r = ratio(num, den);
  if (r === null) return "n/a";
  if (r > 1) return `n/a (${overReason})`;
  return formatPct(r, digits)!;
}

/** Uniform forecast (1/3 to each outcome): Brier summed over the 3 outcomes = (2/3)² + 2·(1/3)² = 0.667. */
export const BRIER_UNIFORM_3WAY = 2 / 3;

export function formatAge(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.floor(seconds));
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export interface FunnelStep {
  label: string;
  value: number;
  unit: string;
}

export interface FunnelLink {
  from: string;
  to: string;
  rate: number | null;
}

/** Step-to-step conversion; null when the previous step is 0. */
export function funnelLinks(steps: FunnelStep[]): FunnelLink[] {
  const out: FunnelLink[] = [];
  for (let i = 1; i < steps.length; i++) {
    out.push({ from: steps[i - 1].label, to: steps[i].label, rate: ratio(steps[i].value, steps[i - 1].value) });
  }
  return out;
}

export type Family = "acquisition" | "activation" | "revenue" | "retention" | "quality";

export interface ProxyTile {
  /** Tile label in the dashboard (unique). */
  label: string;
  /** The KPI of the "BetRedge Execution System" PDF this tile approximates. */
  pdfKpi: string;
  /** What has to exist for the tile to become LIVE. */
  needs: string;
  /** Tracking gaps (content/tracking-gaps.json) that close it. */
  gaps: string[];
  owner: string;
}

// Tiles that stay PROXY because the true number does not exist in any source
// we read. Audited 06/10: everything that could be made LIVE from the DB was
// (signup → profiles, paying → verified + comps apart, Shopify → order count).
// A test keeps this list and content/tracking-gaps.json in sync.
export const PROXY_TILES: ProxyTile[] = [
  { label: "Sessions", pdfKpi: "Organic sessions", needs: "session count including non-consented traffic (G13) and a separate organic source (Search Console, G05)", gaps: ["G13", "G05"], owner: "Calde" },
  { label: "/tools sessions", pdfKpi: "Tool sessions", needs: "session count including non-consented traffic (G13)", gaps: ["G13"], owner: "Calde" },
  { label: "/predictions sessions", pdfKpi: "Match page sessions", needs: "session count including non-consented traffic (G13)", gaps: ["G13"], owner: "Calde" },
  { label: "Cards opened per session", pdfKpi: "Signup → 3 analyses/week", needs: "stable user id in events (G01) + a definition of «analysis» and an analysis_viewed event (G02)", gaps: ["G01", "G02"], owner: "Calde" },
  { label: "Lapsed paid subscriptions", pdfKpi: "Monthly churn", needs: "historical log of subscription states, to know the paying base at the start of the period (G08)", gaps: ["G08"], owner: "Calde" },
  { label: "Odds freshness", pdfKpi: "Odds latency", needs: "the odds timestamp at the source next to captured_at (G09)", gaps: ["G09"], owner: "Calde" },
];

export function proxyTile(label: string): ProxyTile {
  const t = PROXY_TILES.find((x) => x.label === label);
  if (!t) throw new Error(`PROXY tile with no entry in PROXY_TILES: ${label}`);
  return t;
}

export interface MissingKpi {
  family: Family;
  label: string;
  why: string;
  needs: string;
  owner: string;
}

// KPIs from the "BetRedge Execution System" with no data source today.
// Each says why, what unblocks it, and a suggested owner.
export const MISSING_KPIS: MissingKpi[] = [
  { family: "acquisition", label: "CAC per channel", why: "no spend per channel is recorded", needs: "cost per channel (ads, creators, affiliates) in a table or a linked sheet", owner: "Andrea" },
  { family: "activation", label: "WAA (weekly active users)", why: "events has no stable user id: session_id is per session and only with consent", needs: "a stable pseudonymous user id in events for logged-in users", owner: "Calde" },
  { family: "activation", label: "3 analyses / week", why: "events does not tie actions to a user", needs: "user id in events + a definition of «analysis» (card_open? match opened?)", owner: "Calde" },
  { family: "activation", label: "Watchlists created", why: "the watchlist lives only in the browser's localStorage", needs: "a tracked watchlist_add event or a server-side watchlist", owner: "Calde" },
  { family: "activation", label: "First alert set", why: "the alert feature does not exist", needs: "alert feature + alert_set event", owner: "Tommy" },
  { family: "retention", label: "Alerts opened", why: "the alert feature does not exist", needs: "alert feature + alert_opened event", owner: "Tommy" },
  { family: "retention", label: "Retention D7 / D30 / M3", why: "without a user id in events nobody knows who comes back", needs: "stable user id in events (see WAA)", owner: "Calde" },
  { family: "retention", label: "Returning users", why: "session_id changes every session: a return is indistinguishable from a new visitor", needs: "a persistent visitor id (with consent) or a user id for logged-in users", owner: "Calde" },
  { family: "retention", label: "Churn rate", why: "only the count of expiries exists (PROXY tile «Lapsed paid subscriptions»), not the historical denominator of paying users", needs: "a daily history of paying users (snapshot) to compute the base at the start of the period", owner: "Calde" },
  { family: "revenue", label: "MRR", why: "events.value is always 0; Stripe stores no amounts in the DB; Shopify without period/currency normalization", needs: "amount + period + currency for every active subscription, from every channel", owner: "Andrea" },
  { family: "revenue", label: "ARPU", why: "it depends on MRR, which is missing", needs: "MRR (above)", owner: "Andrea" },
  { family: "revenue", label: "Free → paid", why: "today 0 external paying customers with a recorded payment, no written definition of the conversion and no user id in events to follow who moves from free to paying", needs: "at least 1 external paying customer, a definition written by Steve (window, base of external free users, what counts as «paid») and the user id in events (G01)", owner: "Calde" },
  { family: "revenue", label: "Trial → paid", why: "there is no trial", needs: "a trial in the product + a trial_started event", owner: "Andrea" },
  { family: "revenue", label: "Affiliate revenue per user", why: "we record only clicks, not partner conversions", needs: "partner conversion/commission report (postback or export)", owner: "Tommy" },
  { family: "quality", label: "Uptime %", why: "no external monitor records the availability history", needs: "uptime monitor with history (e.g. a periodic check that is stored)", owner: "Calde" },
  { family: "quality", label: "Odds latency", why: "we only have the age of the last saved odds, not the delay against the bookmaker", needs: "the bookmaker's source timestamp next to captured_at", owner: "Calde" },
  { family: "quality", label: "Tracking accuracy", why: "no reconciler between events and external sources (payments, Vercel analytics)", needs: "a job that compares signups/orders in events with profiles/orders", owner: "Calde" },
  { family: "quality", label: "Server error patterns", why: "source never fed: error_patterns_log has never received a row (0 inserts ever, checked on Oct 7), so a 0 there would not mean «no errors»", needs: "a writer that records server error patterns in error_patterns_log (from the logs or the error monitor) and proof that a row really arrives", owner: "Calde" },
  { family: "quality", label: "Verified CLV", why: "closing-line coverage at 1.8% (measured on Sep 17): too low for an honest number", needs: "systematic capture of closing odds", owner: "Calde" },
];
