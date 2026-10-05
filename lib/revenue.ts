// #GROWTH-TRACKING-1006.4 — one source of truth for cash collected, MRR, ARPU
// and annual share across every payment rail (PayGate, PayPal, Shopify, Stripe,
// Weekly Pick). Replaces the old `SUM(events.value)` of /api/admin/metrics,
// which was 0 by construction (/api/track always writes value=0).
// `events.value` is deliberately left alone.
//
// Why Node and not a SQL view: the Shopify period lives only in the variant id
// (env-mapped in resolveOrderFromVariant), and the comp/mirror/refund rules
// would otherwise exist in two places.
//
// The module is split in three layers so the rules are testable without a DB:
//   fetchRawSources (I/O) → buildRevenueRows (pure) → summarizeRevenue (pure).

import { resolveOrderFromVariant, isWeeklyPickVariant } from "@/lib/shopify";

export type Rail = "paygate" | "paypal" | "shopify" | "stripe" | "weekly_pick";
export type Period = "monthly" | "annual";

export type RevenueRow = {
  rail: Rail;
  ref: string;
  identifier: string | null;
  paid_at: string;
  amount_usd: number;
  kind: "plan" | "weekly";
  period: Period | null;
  // true = a contract that renews by itself (Stripe, Shopify subscription SKU).
  recurring: boolean;
};

type Num = string | number | null;

export type RawSources = {
  paygate: { id: string; identifier: string; period: string; amount_usd: Num; status: string; paid_at: string | null; created_at: string; shopify_order_id: string | null }[];
  paypal: { id: string; identifier: string; period: string; amount_usd: Num; status: string; paid_at: string | null; created_at: string }[];
  shopify: { event_id: string; identifier: string | null; variant_id: string | null; amount: Num; status: string | null; processed_at: string }[];
  weekly: { id: string; identifier: string; amount_usd: Num; status: string; paid_at: string | null; created_at: string; shopify_order_id: string | null }[];
  stripe: { event_id: string; identifier: string | null; amount: Num; currency: string | null; period: string | null; processed_at: string }[];
  profiles: { identifier: string; plan: string | null; plan_source: string | null; plan_expires_at: string | null }[];
};

export type ExclusionReason =
  | "shopify_crypto_paygate" // Shopify-checkout crypto order: the cash is the PayGate row
  | "shopify_mirror" // order created by us to mirror a PayGate payment
  | "refunded" // PayPal order marked refunded (no refund date stored → whole order out)
  | "admin_account" // payer is an admin_full profile: test, not revenue
  | "zero_amount"
  | "amount_unknown" // legacy Shopify rows written before the amount column
  | "non_usd_unconverted"; // Stripe in a currency we have no FX for

export type Exclusions = Record<ExclusionReason, { count: number; amount_usd: number }>;

export type BuiltRows = {
  rows: RevenueRow[];
  excluded: Exclusions;
  // Stripe amounts in non-USD currencies, kept visible instead of silently dropped.
  unconverted: { currency: string; amount: number }[];
  paidAtMissing: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: Num): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const normId = (s: string | null | undefined) => (s ? s.trim().toLowerCase() : null);
const asPeriod = (p: string | null | undefined): Period | null =>
  p === "monthly" || p === "annual" ? p : null;

// "gid://shopify/Order/7964071526737" and "7964071526737" are the same order;
// shopify_events.event_id stores the bare numeric id.
export function shopifyOrderNumericId(id: string | null | undefined): string | null {
  if (!id) return null;
  const m = String(id).match(/(\d+)\s*$/);
  return m ? m[1] : null;
}

// Stripe line items carry the billed span, not a period label. Anything longer
// than ~6 months is an annual price.
export function periodFromSpan(startSec: number | null | undefined, endSec: number | null | undefined): Period | null {
  if (!startSec || !endSec || endSec <= startSec) return null;
  return endSec - startSec > 180 * 86400 ? "annual" : "monthly";
}

function emptyExclusions(): Exclusions {
  const reasons: ExclusionReason[] = [
    "shopify_crypto_paygate", "shopify_mirror", "refunded", "admin_account",
    "zero_amount", "amount_unknown", "non_usd_unconverted",
  ];
  return Object.fromEntries(reasons.map((r) => [r, { count: 0, amount_usd: 0 }])) as Exclusions;
}

export function buildRevenueRows(raw: RawSources): BuiltRows {
  const excluded = emptyExclusions();
  const unconverted: { currency: string; amount: number }[] = [];
  const rows: RevenueRow[] = [];
  let paidAtMissing = 0;
  const exclude = (reason: ExclusionReason, amount: number | null) => {
    excluded[reason].count += 1;
    excluded[reason].amount_usd = r2(excluded[reason].amount_usd + (amount ?? 0));
  };

  const admins = new Set(
    raw.profiles.filter((p) => p.plan === "admin_full").map((p) => normId(p.identifier))
  );
  // Shopify orders we created ourselves to mirror a crypto payment.
  const mirrors = new Set(
    [...raw.paygate, ...raw.weekly]
      .map((o) => shopifyOrderNumericId(o.shopify_order_id))
      .filter((x): x is string => x != null)
  );

  const push = (row: Omit<RevenueRow, "amount_usd">, amount: number | null) => {
    if (amount == null) return exclude("amount_unknown", null);
    if (amount <= 0) return exclude("zero_amount", amount);
    if (row.identifier && admins.has(row.identifier)) return exclude("admin_account", amount);
    rows.push({ ...row, amount_usd: r2(amount) });
  };
  // status='paid' with paid_at NULL exists in prod (manual fix): fall back to
  // created_at and count it, rather than dropping real cash.
  const paidAt = (o: { paid_at: string | null; created_at: string }) => {
    if (o.paid_at) return o.paid_at;
    paidAtMissing += 1;
    return o.created_at;
  };

  for (const o of raw.paygate) {
    if (o.status !== "paid") continue;
    push({ rail: "paygate", ref: o.id, identifier: normId(o.identifier), paid_at: paidAt(o), kind: "plan", period: asPeriod(o.period), recurring: false }, num(o.amount_usd));
  }
  for (const o of raw.paypal) {
    if (o.status === "refunded") { exclude("refunded", num(o.amount_usd)); continue; }
    if (o.status !== "paid") continue;
    push({ rail: "paypal", ref: o.id, identifier: normId(o.identifier), paid_at: paidAt(o), kind: "plan", period: asPeriod(o.period), recurring: false }, num(o.amount_usd));
  }
  for (const o of raw.weekly) {
    if (o.status !== "paid") continue;
    push({ rail: "weekly_pick", ref: o.id, identifier: normId(o.identifier), paid_at: paidAt(o), kind: "weekly", period: null, recurring: false }, num(o.amount_usd));
  }
  for (const e of raw.shopify) {
    const amount = num(e.amount);
    if (e.status === "crypto-paygate") { exclude("shopify_crypto_paygate", amount); continue; }
    if (mirrors.has(e.event_id)) { exclude("shopify_mirror", amount); continue; }
    const resolved = resolveOrderFromVariant(e.variant_id);
    const weekly = !resolved && isWeeklyPickVariant(e.variant_id);
    push({
      rail: "shopify", ref: e.event_id, identifier: normId(e.identifier), paid_at: e.processed_at,
      kind: weekly ? "weekly" : "plan",
      period: resolved?.period ?? null,
      recurring: resolved?.recurring ?? false,
    }, amount);
  }
  for (const e of raw.stripe) {
    const amount = num(e.amount);
    const cur = (e.currency ?? "usd").toLowerCase();
    if (amount != null && cur !== "usd") {
      exclude("non_usd_unconverted", null);
      unconverted.push({ currency: cur, amount });
      continue;
    }
    push({ rail: "stripe", ref: e.event_id, identifier: normId(e.identifier), paid_at: e.processed_at, kind: "plan", period: asPeriod(e.period), recurring: true }, amount);
  }

  rows.sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  return { rows, excluded, unconverted, paidAtMissing };
}

export type RevenueWindow = { from?: string | null; to?: string | null };

export type RevenueReport = {
  window: { from: string | null; to: string | null };
  cash: {
    total_usd: number;
    count: number;
    by_rail: Record<string, { count: number; amount_usd: number }>;
    by_month: { month: string; count: number; amount_usd: number }[];
  };
  mrr: {
    recurring_usd: number;
    non_recurring_usd: number;
    total_usd: number;
    active_paying: number;
    active_paid_without_payment: number;
    comps_active: number;
  };
  arpu_usd: number | null;
  annual_share: { by_count: number | null; by_amount: number | null; plan_payments_with_period: number };
  excluded: Exclusions;
  unconverted: { currency: string; amount: number }[];
  paid_at_missing: number;
  source_errors: string[];
  as_of: string;
};

const COMP_SOURCES = new Set(["manual", "referral"]);

// Inclusive YYYY-MM-DD bounds; `to` covers the whole day.
function inWindow(paidAt: string, w: RevenueWindow): boolean {
  const t = Date.parse(paidAt);
  if (w.from && t < Date.parse(`${w.from}T00:00:00Z`)) return false;
  if (w.to && t >= Date.parse(`${w.to}T00:00:00Z`) + 86400000) return false;
  return true;
}

export function summarizeRevenue(
  built: BuiltRows,
  profiles: RawSources["profiles"],
  opts: RevenueWindow & { now?: Date; sourceErrors?: string[] } = {}
): RevenueReport {
  const now = opts.now ?? new Date();
  const inRange = built.rows.filter((r) => inWindow(r.paid_at, opts));

  const byRail: Record<string, { count: number; amount_usd: number }> = {};
  const byMonth = new Map<string, { count: number; amount_usd: number }>();
  let total = 0;
  for (const r of inRange) {
    total += r.amount_usd;
    const br = (byRail[r.rail] ??= { count: 0, amount_usd: 0 });
    br.count += 1;
    br.amount_usd = r2(br.amount_usd + r.amount_usd);
    const m = r.paid_at.slice(0, 7);
    const bm = byMonth.get(m) ?? { count: 0, amount_usd: 0 };
    bm.count += 1;
    bm.amount_usd = r2(bm.amount_usd + r.amount_usd);
    byMonth.set(m, bm);
  }

  // Annual share: plan payments in the window whose period is known.
  const withPeriod = inRange.filter((r) => r.kind === "plan" && r.period != null);
  const annual = withPeriod.filter((r) => r.period === "annual");
  const sum = (xs: RevenueRow[]) => xs.reduce((s, r) => s + r.amount_usd, 0);
  const share = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 10000 : null);

  // MRR as of `now`: every active, non-comp profile, normalised from its LAST
  // plan payment (any rail). Non-renewing rails are reported apart, not summed
  // into the recurring figure.
  const lastPlanPayment = new Map<string, RevenueRow>();
  for (const r of built.rows) {
    if (r.kind !== "plan" || !r.identifier || Date.parse(r.paid_at) > now.getTime()) continue;
    lastPlanPayment.set(r.identifier, r); // rows are sorted ascending → last wins
  }
  let recurring = 0;
  let nonRecurring = 0;
  let activePaying = 0;
  let withoutPayment = 0;
  let comps = 0;
  for (const p of profiles) {
    if (p.plan !== "base" && p.plan !== "premium") continue;
    // Same rule as effectivePlan (lib/auth.ts): NULL expiry = legacy row that
    // is still active; a malformed date fails closed.
    if (p.plan_expires_at) {
      const t = Date.parse(p.plan_expires_at);
      if (Number.isNaN(t) || t <= now.getTime()) continue;
    }
    if (p.plan_source && COMP_SOURCES.has(p.plan_source)) { comps += 1; continue; }
    const last = lastPlanPayment.get(normId(p.identifier) ?? "");
    if (!last) { withoutPayment += 1; continue; }
    activePaying += 1;
    const monthly = last.period === "annual" ? last.amount_usd / 12 : last.amount_usd;
    if (last.recurring) recurring += monthly;
    else nonRecurring += monthly;
  }
  const mrrTotal = recurring + nonRecurring;

  return {
    window: { from: opts.from ?? null, to: opts.to ?? null },
    cash: {
      total_usd: r2(total),
      count: inRange.length,
      by_rail: byRail,
      by_month: [...byMonth.entries()].sort().map(([month, v]) => ({ month, ...v })),
    },
    mrr: {
      recurring_usd: r2(recurring),
      non_recurring_usd: r2(nonRecurring),
      total_usd: r2(mrrTotal),
      active_paying: activePaying,
      active_paid_without_payment: withoutPayment,
      comps_active: comps,
    },
    arpu_usd: activePaying > 0 ? r2(mrrTotal / activePaying) : null,
    annual_share: {
      by_count: share(annual.length, withPeriod.length),
      by_amount: share(sum(annual), sum(withPeriod)),
      plan_payments_with_period: withPeriod.length,
    },
    excluded: built.excluded,
    unconverted: built.unconverted,
    paid_at_missing: built.paidAtMissing,
    source_errors: opts.sourceErrors ?? [],
    as_of: now.toISOString(),
  };
}

export type QueryFn = <T>(sql: string) => Promise<T[]>;

// Each source is read on its own: one failing table (e.g. stripe_events before
// its amount migration is applied) is reported in source_errors instead of
// zeroing — or hiding — the whole report.
export async function fetchRawSources(query: QueryFn): Promise<{ raw: RawSources; errors: string[] }> {
  const errors: string[] = [];
  const read = async <K extends keyof RawSources>(name: K, sql: string): Promise<RawSources[K]> => {
    try {
      return await query<RawSources[K][number]>(sql) as RawSources[K];
    } catch (e) {
      errors.push(`${name}: ${String(e instanceof Error ? e.message : e).slice(0, 200)}`);
      return [] as unknown as RawSources[K];
    }
  };
  const [paygate, paypal, shopify, weekly, stripe, profiles] = await Promise.all([
    read("paygate", `SELECT id::text AS id, identifier, period, amount_usd, status, paid_at::text AS paid_at,
                            created_at::text AS created_at, shopify_order_id
                       FROM paygate_orders WHERE status = 'paid' OR shopify_order_id IS NOT NULL`),
    read("paypal", `SELECT id::text AS id, identifier, period, amount_usd, status, paid_at::text AS paid_at,
                           created_at::text AS created_at
                      FROM paypal_orders WHERE status IN ('paid','refunded')`),
    read("shopify", `SELECT event_id, identifier, variant_id, amount, status, processed_at::text AS processed_at
                       FROM shopify_events WHERE event_type = 'orders/paid'`),
    read("weekly", `SELECT id::text AS id, identifier, amount_usd, status, paid_at::text AS paid_at,
                           created_at::text AS created_at, shopify_order_id
                      FROM weekly_pick_orders WHERE status = 'paid' OR shopify_order_id IS NOT NULL`),
    read("stripe", `SELECT event_id, identifier, amount, currency, period, processed_at::text AS processed_at
                      FROM stripe_events WHERE event_type = 'invoice.paid'`),
    read("profiles", `SELECT identifier, plan, plan_source, plan_expires_at::text AS plan_expires_at
                        FROM profiles WHERE plan IN ('base','premium','admin_full')`),
  ]);
  return { raw: { paygate, paypal, shopify, weekly, stripe, profiles }, errors };
}

// Postgres `::text` timestamps ("2026-07-15 01:05:20.757+00") → ISO, so month
// bucketing and Date.parse behave the same everywhere.
function isoize(raw: RawSources): RawSources {
  const iso = (s: string | null) => (s ? new Date(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString() : s);
  return {
    paygate: raw.paygate.map((o) => ({ ...o, paid_at: iso(o.paid_at), created_at: iso(o.created_at)! })),
    paypal: raw.paypal.map((o) => ({ ...o, paid_at: iso(o.paid_at), created_at: iso(o.created_at)! })),
    weekly: raw.weekly.map((o) => ({ ...o, paid_at: iso(o.paid_at), created_at: iso(o.created_at)! })),
    shopify: raw.shopify.map((e) => ({ ...e, processed_at: iso(e.processed_at)! })),
    stripe: raw.stripe.map((e) => ({ ...e, processed_at: iso(e.processed_at)! })),
    profiles: raw.profiles.map((p) => ({ ...p, plan_expires_at: iso(p.plan_expires_at) })),
  };
}

export async function computeRevenue(
  query: QueryFn,
  opts: RevenueWindow & { now?: Date } = {}
): Promise<RevenueReport> {
  const { raw, errors } = await fetchRawSources(query);
  const clean = isoize(raw);
  return summarizeRevenue(buildRevenueRows(clean), clean.profiles, { ...opts, sourceErrors: errors });
}
