// The whole dashboard as one presentational component: no auth, no data
// loading, no router. The host (this app's page, or the CRM later) passes the
// data, where it came from, and how to build a link for another window.
// Ported from PR #516 (app/admin/growth/page.tsx); v6 layout from
// docs/design-v6/README.md. The tile builders (what each number is, its
// caveat, its status) are unchanged from v5: only where and how they render.

import type { CSSProperties, ReactNode } from "react";
import {
  BRIER_UNIFORM_3WAY,
  type Family,
  type GrowthWindow,
  type KpiStatus,
  MIN_ORDERS_FOR_SHARE,
  MISSING_KPIS,
  WINDOWS,
  formatAge,
  formatPct,
  formatShare,
  proxyTile,
  ratio,
  splitPaying,
  windowLabel,
} from "@/core/kpi";
import {
  type EntryRow,
  HUMAN_ESTIMATE_MARGIN,
  HUMAN_FILTER_CRITERIA,
  INTERNAL_REFERRER_RULE,
  NO_COUNTRY_SPIKE_SHARE,
  noCountrySpike,
  splitEntries,
  splitFolded,
} from "@/core/estimate";
import type { Calibration, GrowthData, Result, SourceMeta } from "@/core/model";
import { CLIENT_ERROR_DEDUP_SECONDS } from "@/core/sql";
import gapsJson from "@/content/tracking-gaps.json";
import { Lockup } from "./brand/Lockup";
import { Chip, LOCALE, LockIcon, MARK_LABEL, type Mark, SectionTitle, Why, fmtInt, sourceLabel } from "./primitives";
import { Channels } from "./sections/Channels";
import { FAMILY_ID, FAMILY_LABEL, MissingData } from "./sections/MissingData";
import { Today } from "./sections/Today";
import { Trends } from "./sections/Trends";
import { ThemeToggle } from "./ThemeToggle";
import { validateGaps } from "./work/content";

export interface GrowthDashboardProps {
  data: GrowthData;
  meta: SourceMeta;
  /** URL for the same dashboard on another window, e.g. (w) => `?w=${w}`. */
  hrefFor: (w: GrowthWindow) => string;
  /** Optional link to the work page (/lavoro in the standalone app, titled «Work»); omitted → no link. */
  workHref?: string;
}

// ─── Tile model (unchanged from v5) ─────────────────────────────────────────

interface TileProps {
  label: string;
  status: KpiStatus;
  /** Badge text instead of the status name (e.g. ESTIMATED on a PROXY estimate). */
  badge?: string;
  /** null for LIVE/PROXY means "not computable" (denominator 0, empty table) — rendered as n/a, never 0. */
  value?: string | null;
  sub?: string;
  window: string;
  caveat: string;
  needs?: string;
  owner?: string;
}

function errorTile(label: string, window: string): TileProps {
  return { label, status: "ERRORE", window, caveat: "The query failed: try reloading. The value is not replaced with 0." };
}

/** Build a tile from a query result; a failed read becomes an ERRORE tile. */
function fromResult<T>(r: Result<T>, label: string, window: string, build: (d: T) => Omit<TileProps, "label" | "window">): TileProps {
  return r.ok ? { label, window, ...build(r.data) } : errorTile(label, window);
}

/** PROXY tile: always says which KPI it approximates and what makes it real (core/kpi.ts PROXY_TILES). */
function proxy<T>(label: string, window: string, r: Result<T>, build: (d: T) => Omit<TileProps, "label" | "window" | "status" | "needs" | "owner">): TileProps {
  if (!r.ok) return errorTile(label, window);
  const p = proxyTile(label);
  const t = build(r.data);
  return { label, window, status: "PROXY", ...t, caveat: `Approximates «${p.pdfKpi}». ${t.caveat}`, needs: `${p.needs} — ${p.gaps.join(", ")} in Work`, owner: p.owner };
}

/** A field a query should return; absent (older snapshot) → the tile is ERRORE, never 0. */
const has = (o: Record<string, number>, ...keys: string[]) => keys.every((k) => Number.isFinite(o[k]));

const ENTRY_ROWS_SHOWN = 20;

function entriesTile(d: GrowthData, window: string): TileProps {
  return fromResult(d.entries, "Entries with a source", window, (rows) => {
    const { external, internal } = splitEntries(rows);
    const withSource = external.reduce((s, r) => s + r.entries, 0);
    const pv = d.traffic.ok ? d.traffic.data.page_views : null;
    const noSource = pv === null ? null : pv - withSource - internal;
    return {
      status: "LIVE",
      value: fmtInt(withSource),
      sub:
        (noSource === null
          ? "page views without a source: n/a (the page view read failed)"
          : `page views with no source at all: ${fmtInt(noSource)} of ${fmtInt(pv!)} (${formatPct(ratio(noSource, pv!), 0) ?? "n/a"})`) +
        ` · internal (excluded): ${fmtInt(internal)}`,
      caveat: `Entry page views with utm_source, src, crm, ref or an external referrer (cut to the domain), recorded even without consent. It counts entry pages, not people: a reload counts twice, crawlers included. Internal/test entries are excluded: ${INTERNAL_REFERRER_RULE}. The no-source share is on page views, not on entries: a direct entry cannot be told apart from a later page (the tracker does not mark the entry), so it is an upper bound.`,
    };
  });
}

/** Top rows, the rest summed in one explicit row (the total never changes). */
function topEntries(all: Result<EntryRow[]>): Result<EntryRow[]> {
  const r: Result<EntryRow[]> = all.ok ? { ok: true, data: splitEntries(all.data).external } : all;
  if (!r.ok || r.data.length <= ENTRY_ROWS_SHOWN) return r;
  const rest = r.data.slice(ENTRY_ROWS_SHOWN - 1);
  return {
    ok: true,
    data: [...r.data.slice(0, ENTRY_ROWS_SHOWN - 1), { source: `(${rest.length} other sources)`, entries: rest.reduce((s, x) => s + x.entries, 0) }],
  };
}

const SOURCE_ROWS_SHOWN = 15;
type SourceRow = { source: string; sessions: number };

/** Sessions per source without the internal/test row, top 15 + the rest in one explicit row. */
function topSources(all: Result<SourceRow[]>): Result<SourceRow[]> {
  if (!all.ok) return all;
  const ext = splitFolded(all.data, (r) => r.source, (r) => r.sessions).external;
  if (ext.length <= SOURCE_ROWS_SHOWN) return { ok: true, data: ext };
  const rest = ext.slice(SOURCE_ROWS_SHOWN - 1);
  return { ok: true, data: [...ext.slice(0, SOURCE_ROWS_SHOWN - 1), { source: `(${rest.length} other sources)`, sessions: rest.reduce((s, x) => s + x.sessions, 0) }] };
}

/** The «internal/test (excluded)» line under a per-source table: its count and the rule. */
function InternalFooter({ n }: { n: number }) {
  return (
    <div className="g-rule pt-2" data-internal-row>
      <div className="flex justify-between text-[14px] g-muted">
        <span>internal/test (excluded)</span>
        <span className="g-tab">{fmtInt(n)}</span>
      </div>
      <div className="g-meta">Not added above: {INTERNAL_REFERRER_RULE}.</div>
    </div>
  );
}

const fmtUsd = (n: number) => `$${n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CAL_WINDOW = "all closed matches · last prediction before kickoff";
const fmtDec = (x: number, digits = 4) => x.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Model vs market on the SAME matches, both numbers or n/a. */
function marketLine(c: Calibration): string {
  if (c.market_matches === 0 || c.brier_same === null || c.brier_market === null) return "market: n/a (no match with market probabilities)";
  return `on the ${fmtInt(c.market_matches)} matches with odds: model ${fmtDec(c.brier_same)}, market ${fmtDec(c.brier_market)}`;
}

/** Plain statement of the comparison, never a claim: it says who is lower, nothing more. */
function verdict(c: Calibration): string {
  if (c.brier_same === null || c.brier_market === null) return "The comparison with the market cannot be computed.";
  if (c.brier_same > c.brier_market) return "On the same matches the model does NOT do better than the market (its Brier is higher).";
  if (c.brier_same < c.brier_market) return "On the same matches the model's Brier is lower than the market's: it is an internal measure, not proof of an economic edge.";
  return "On the same matches model and market have the same Brier.";
}

// ─── Rendering pieces ───────────────────────────────────────────────────────

/** The chip a tile wears: PROXY with the ESTIMATED badge is the estimate mark. */
const markOf = (t: TileProps): Mark => (t.status === "PROXY" && t.badge === "ESTIMATED" ? "EST" : t.status);

const ERR_STYLE: CSSProperties = { color: "var(--s-err)" };

function ValueLine({ t, size }: { t: TileProps; size: "lg" | "md" | "sm" }) {
  if (t.status === "ERRORE") {
    return (
      <span className="text-[14px] font-semibold" style={ERR_STYLE} data-kpi={t.label} data-value="read failed">
        Read failed — no value shown
      </span>
    );
  }
  if (t.value === null || t.value === undefined) {
    return (
      <span data-kpi={t.label} data-value="n/a">
        <span className={`g-num g-num--${size === "lg" ? "md" : "sm"}`}>n/a</span>
        <span className="g-meta block">not computable: nothing to divide by</span>
      </span>
    );
  }
  return (
    <span className={`g-num g-num--${size}`} data-kpi={t.label} data-value={t.value}>
      {t.value}
    </span>
  );
}

function CaveatBody({ t }: { t: TileProps }) {
  return (
    <>
      {t.sub && (
        <p className="mb-1">
          <b>{t.sub}</b>
        </p>
      )}
      <p>{t.caveat}</p>
      <p className="mt-1">
        <b>Window:</b> {t.window}
      </p>
      {t.needs && (
        <p className="mt-1">
          <b>Needs:</b> {t.needs}
          {t.owner && (
            <>
              {" "}
              · <b>unblocks:</b> {t.owner}
            </>
          )}
        </p>
      )}
    </>
  );
}

/** One of the six big KPI: number, mark, the raw count next to the estimate, «why ▸». */
function PrimaryCard({ t, pair }: { t: TileProps; pair?: TileProps }) {
  return (
    <article className="g-card p-4 flex flex-col gap-2 min-w-0">
      <div className="flex flex-col gap-0.5">
        <h3 className="g-label">{t.label}</h3>
        <span className="g-meta">{t.window}</span>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mt-1">
        <div className="flex flex-col gap-2">
          <ValueLine t={t} size="lg" />
          <span>
            <Chip mark={markOf(t)} />
          </span>
        </div>
        {pair && (
          <div className="flex flex-col gap-1 pl-4" style={{ borderLeft: "1px solid var(--line)" }}>
            <span className="g-meta">raw</span>
            <ValueLine t={pair} size="md" />
            <span>
              <Chip mark={markOf(pair)} />
            </span>
          </div>
        )}
      </div>
      {t.sub && (
        <p className="g-meta" data-sub={t.label}>
          {t.sub}
        </p>
      )}
      {pair?.sub && (
        <p className="g-meta" data-sub={pair.label}>
          raw: {pair.sub}
        </p>
      )}
      <Why>
        <CaveatBody t={t} />
        {pair && (
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
            <b>{pair.label}</b>
            <CaveatBody t={pair} />
          </div>
        )}
      </Why>
    </article>
  );
}

/** The secondary KPI of a family, one disclosure row each; the family's missing KPI close the list as one grey row. */
function SecondaryRows({ tiles, missing }: { tiles: TileProps[]; missing: string[] }) {
  return (
    <div className="g-card g-rows py-2">
      <div className="g-rows-head">
        <span>Metric</span>
        <span>Value</span>
        <span>Status</span>
        <span>Window</span>
        <span className="text-right">why</span>
      </div>
      {tiles.map((t) => (
        <details key={t.label} className="g-row">
          <summary>
            <span className="c-m min-w-0">
              <span className="g-label block">{t.label}</span>
              {t.sub && (
                <span className="g-meta block" data-sub={t.label}>
                  {t.sub}
                </span>
              )}
            </span>
            <span className="c-v min-w-0 break-words">
              <ValueLine t={t} size="sm" />
            </span>
            <span className="c-s">
              <Chip mark={markOf(t)} />
            </span>
            <span className="c-w g-meta">{t.window}</span>
            <span className="c-c g-why-cta">
              why <span className="g-caret" aria-hidden="true">▸</span>
            </span>
          </summary>
          <div className="g-why-body">
            <CaveatBody t={t} />
          </div>
        </details>
      ))}
      {missing.length > 0 && (
        <div className="g-row g-row--manca">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[44px] px-[14px] py-1.5 text-[14px] g-muted">
            <LockIcon className="shrink-0" />
            <span>
              Not measured in this section: {missing.join(" · ")} → <a href="#missing">Data we do not have yet</a>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallTable<T>({
  title,
  mark,
  caveat,
  rows,
  cols,
  empty,
  footer,
}: {
  title: string;
  mark: Mark;
  caveat: string;
  rows: Result<T[]>;
  cols: { h: string; get: (r: T) => string | number; right?: boolean }[];
  empty: string;
  /** Shown under the table when the read succeeded (e.g. rows excluded from it, with the rule). */
  footer?: ReactNode;
}) {
  return (
    <div className="g-card p-4 flex flex-col gap-2 min-w-0" data-table={title}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="g-h g-h--card">{title}</h3>
        <Chip mark={rows.ok ? mark : "ERRORE"} />
      </div>
      <Why>{caveat}</Why>
      {!rows.ok ? (
        <p className="text-[14px]" style={ERR_STYLE}>
          Read failed — no value shown
        </p>
      ) : rows.data.length === 0 ? (
        <p className="text-[14px] g-muted">{empty}</p>
      ) : (
        <table className="g-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.h} className={c.right ? "r" : ""}>
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.data.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.h} className={c.right ? "r g-ink" : "break-all"}>
                    {c.get(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.ok && footer}
    </div>
  );
}

function missingLabels(family: Family): string[] {
  return MISSING_KPIS.filter((m) => m.family === family).map((m) => m.label);
}

/** The six KPI that open the page; the raw page views ride inside the estimate's card. */
const PRIMARY = ["Probably human page views", "Sessions", "Signups completed", "New profiles", "External paying customers", "External revenue Paygate + PayPal"] as const;
const PAIRED = "Page views (raw)";

const FAMILY_HINT: Record<Family, string> = {
  acquisition: "where they come from",
  activation: "who signs up and starts using it",
  revenue: "who pays and how much",
  retention: "who stays",
  quality: "does the product hold up?",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export function GrowthDashboard({ data: d, meta, hrefFor, workHref }: GrowthDashboardProps) {
  const w = d.window;
  const W = windowLabel(w);
  const isSnapshot = meta.kind === "snapshot";
  const NOW = isSnapshot ? "at the time of the snapshot" : "now (point in time)";
  const ALL = "all time (cumulative)";

  // Same time zone as before (Europe/Rome, the team's day and the «Today» window), English format, 24-hour clock.
  const updated = new Date(meta.asOf).toLocaleString(LOCALE, { timeZone: "Europe/Rome", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const updatedTime = new Date(meta.asOf).toLocaleTimeString(LOCALE, { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  // Share of page_views without session_id in THIS window (measured, not assumed).
  const noSessShare = d.traffic.ok ? formatPct(ratio(d.traffic.data.page_views_no_session, d.traffic.data.page_views), 0) : null;
  // Page views without country in THIS window: above NO_COUNTRY_SPIKE_SHARE the totals are flagged.
  const spike = d.humanTraffic.ok ? noCountrySpike(d.humanTraffic.data.excl_no_country, d.humanTraffic.data.page_views) : null;
  const sessCaveat = `GDPR-consented traffic only: ${noSessShare ?? "a share"} of the page_views in the window have no session_id and are not counted here.`;

  // ── Stage counts (was «Funnel»: same four counts, no arrows, no rates) ──
  const { traffic, funnelEvents, newProfiles, revenue: rev, shopify } = d;
  const funnelOk = traffic.ok && funnelEvents.ok && newProfiles.ok && rev.ok && shopify.ok;
  const funnelSteps =
    traffic.ok && funnelEvents.ok && newProfiles.ok && rev.ok && shopify.ok
      ? [
          { label: "Visitors", value: traffic.data.sessions, unit: "consented sessions" },
          { label: "Signups started", value: funnelEvents.data.signup_started, unit: "signup_started events" },
          { label: "Profiles created", value: newProfiles.data.new_profiles, unit: "profiles rows (DB)" },
          { label: "Paid orders", value: rev.data.orders_w + shopify.data.orders_w, unit: "Paygate + PayPal + Shopify" },
        ]
      : [];

  // ── Acquisition ──
  const acquisition: TileProps[] = [
    fromResult(d.humanTraffic, "Probably human page views", W, (h) => ({
      status: "PROXY",
      badge: "ESTIMATED",
      value: fmtInt(h.probably_human),
      sub: `of ${fmtInt(h.page_views)} raw · excluded: ${fmtInt(h.excl_no_country)} without country, ${fmtInt(h.excl_country)} from countries without sessions, ${fmtInt(h.excl_burst)} in bursts · wide margin: Oct 7 audit 109–310 over 7d, 685–2,148 over 30d`,
      caveat: `ESTIMATED, not measured: the data has no user-agent, so «not human» is deduced, never observed. Criterion (exclusive classes, in this order): ${HUMAN_FILTER_CRITERIA.map((c, i) => `${i + 1}) ${c}`).join("; ")}. Margin: ${HUMAN_ESTIMATE_MARGIN}. Traffic probably from the team is not excluded. The raw number stays next to it, «Page views (raw)».`,
      needs: "user-agent read (without storing it) and a bot filter in /api/track — lever 2 of #SESSIONI-1006",
      owner: "Calde",
    })),
    fromResult(d.traffic, "Page views (raw)", W, (t) => ({
      status: "LIVE",
      value: fmtInt(t.page_views),
      sub: `${fmtInt(t.page_views_no_session)} without session_id (${noSessShare ?? "n/a"})${spike?.share != null ? ` · ${formatPct(spike.share, 0)} without country` : ""}`,
      caveat: "Every recorded page_view, with and without consent: crawlers, synthetic jobs and traffic without country included. The number to read for people is «Probably human page views» (ESTIMATED).",
    })),
    entriesTile(d, W),
    proxy("Sessions", W, d.traffic, (t) => ({ value: fmtInt(t.sessions), caveat: `All sources, not just organic. ${sessCaveat}` })),
    proxy("/tools sessions", W, d.traffic, (t) => ({
      value: fmtInt(t.tools_sessions),
      caveat: `Sessions with at least one page_view on /tools* (language prefix included). ${sessCaveat}`,
    })),
    proxy("/predictions sessions", W, d.traffic, (t) => ({
      value: fmtInt(t.predictions_sessions),
      caveat: `Sessions with at least one page_view on /predictions* (language prefix included): it is the predictions list, the product has no separate match pages. ${sessCaveat}`,
    })),
    fromResult(d.newProfiles, "New signups with referral", W, (p) => ({
      status: "LIVE",
      value: fmtInt(p.referred),
      sub: `of ${fmtInt(p.new_profiles)} new profiles`,
      caveat: "Profiles created in the window with referred_by set (creator / invite).",
    })),
  ];

  // ── Activation ──
  const activation: TileProps[] = [
    fromResult(d.newProfiles, "New profiles", W, (p) => ({
      status: "LIVE",
      value: fmtInt(p.new_profiles),
      caveat: "Rows created in profiles in the window. Includes any team test accounts.",
    })),
    fromResult(d.newProfiles, "Activated accounts", W, (p) => ({
      status: "LIVE",
      value: p.new_profiles > 0 ? `${fmtInt(p.activated)} / ${fmtInt(p.new_profiles)}` : null,
      sub: formatPct(ratio(p.activated, p.new_profiles), 0) ?? undefined,
      caveat: "Profiles created in the window with activated_at set (activation link clicked).",
    })),
    d.newProfiles.ok && has(d.newProfiles.data, "signups")
      ? {
          label: "Signups completed",
          status: "LIVE",
          value: fmtInt(d.newProfiles.data.signups),
          window: W,
          sub: d.funnelEvents.ok
            ? has(d.funnelEvents.data, "signup_started_no_session")
              ? `client tracking: ${fmtInt(d.funnelEvents.data.signup_completed)} signup_completed events, ${fmtInt(d.funnelEvents.data.signup_started)} signup_started (${fmtInt(d.funnelEvents.data.signup_started_no_session)} without session)`
              : "tracking events: read in the old format, n/a"
            : "tracking events: read failed",
          caveat: "Profiles created by the registration form in the window (the only insert that records acceptance of the terms; accounts created by hand are excluded). Client events can get lost or duplicated: here they only measure the tracking.",
        }
      : errorTile("Signups completed", W),
    fromResult(d.funnelEvents, "Signup pop-up", W, (f) => ({
      status: "LIVE",
      value: `${fmtInt(f.popup_shown)} shown`,
      sub: `${fmtInt(f.popup_cta)} CTA clicks · ${fmtInt(f.popup_dismissed)} dismissed`,
      caveat: "signup_popup_* events: they measure the pop-up, not the signups that come from it.",
    })),
    fromResult(d.funnelEvents, "Purchase intent", W, (f) => ({
      status: "LIVE",
      value: `${fmtInt(f.plan_view)} → ${fmtInt(f.plan_cta_click)} → ${fmtInt(f.checkout_opened)}`,
      sub: "plan_view → plan_cta_click → checkout_opened",
      caveat: "Event counts, not people: one person can generate more than one.",
    })),
    d.funnelEvents.ok && !has(d.funnelEvents.data, "card_open_with_session")
      ? errorTile("Cards opened per session", W)
      : proxy("Cards opened per session", W, d.funnelEvents, (f) => ({
          value: f.card_open_sessions > 0 ? fmtDec(f.card_open_with_session / f.card_open_sessions, 1) : null,
          sub: `${fmtInt(f.card_open_with_session)} card_open with a session in ${fmtInt(f.card_open_sessions)} sessions · ${fmtInt(f.card_open - f.card_open_with_session)} without session excluded`,
          caveat:
            "Anonymous engagement, not per user: card_open with a session divided by the sessions that opened at least one. Numerator and denominator share the same base (consented sessions only): cards opened without a session cannot be attributed to any session and stay out. Part of the sessions is probably the team's (Oct 7 audit), not excluded.",
        })),
  ];

  // ── Revenue ──
  const paying = d.plans.ok ? splitPaying(d.plans.data) : null;
  // #GROWTH-V7: internal/test accounts (content/internal-accounts.json) never count as customers or revenue.
  const revOk = d.revenue.ok && has(d.revenue.data, "internal_usd_all", "internal_orders_w");
  const revenue: TileProps[] = [
    paying
      ? {
          label: "External paying customers",
          status: "LIVE",
          value: fmtInt(paying.external),
          sub: `apart, not counted: ${fmtInt(paying.internalWithPlan)} internal/test accounts with a plan (of which ${fmtInt(paying.internalAdminFull)} admin_full) · ${fmtInt(paying.comp)} comps/manual/no source · ${fmtInt(paying.externalNoPayment)} with a plan from a paid channel but no paid order recorded · ${fmtInt(paying.expiredNotSwept)} expired, not yet downgraded`,
          window: `${NOW} · state of all profiles`,
          caveat:
            "External profiles (not in the internal/test list) with a base/premium plan from a paid channel (Paygate, PayPal, Shopify, Stripe), not expired and with at least one paid order recorded. It is the current state of all profiles, not the profiles created in the window (those are the «External paying (today)» column of the Chain). Internal/test accounts = list of ids in content/internal-accounts.json, generated locally by scripts/internal-accounts.ts: a new team account stays external until the list is regenerated.",
        }
      : errorTile("External paying customers", NOW),
    paying
      ? {
          label: "Free",
          status: "LIVE",
          value: fmtInt(paying.free),
          sub: `of which ${fmtInt(paying.freeInternal)} internal/test accounts · ${fmtInt(paying.team)} team accounts (admin_full) not included`,
          window: NOW,
          caveat: "Profiles with plan = free, internal/test accounts included (counted apart in the subtitle).",
        }
      : errorTile("Free", NOW),
    revOk && d.revenue.ok
      ? {
          label: "External revenue Paygate + PayPal",
          status: "LIVE",
          value: fmtUsd(d.revenue.data.usd_w),
          window: W,
          sub: `${fmtInt(d.revenue.data.orders_w)} external orders in the window · apart, internal/test: ${fmtUsd(d.revenue.data.internal_usd_w)} (${fmtInt(d.revenue.data.internal_orders_w)} orders)`,
          caveat: "Sum of amount_usd of the orders with paid_at in the window, excluding orders from internal/test accounts (list of ids in content/internal-accounts.json). Stripe stores no amounts in the DB: excluded. Shopify apart: unknown currency.",
        }
      : errorTile("External revenue Paygate + PayPal", W),
    revOk && d.revenue.ok
      ? {
          label: "External revenue Paygate + PayPal (total)",
          status: "LIVE",
          value: fmtUsd(d.revenue.data.usd_all),
          window: ALL,
          sub: `${fmtInt(d.revenue.data.orders_all)} external paid orders · ${fmtInt(d.revenue.data.granted_unpaid)} external accesses granted without payment, not added`,
          caveat: "Same rule as the control tower (paid_at set), excluding orders from internal/test accounts, which are in the «Internal/test cash» row.",
        }
      : errorTile("External revenue Paygate + PayPal (total)", ALL),
    revOk && d.revenue.ok
      ? {
          label: "Internal/test cash Paygate + PayPal (total)",
          status: "LIVE",
          value: fmtUsd(d.revenue.data.internal_usd_all),
          window: ALL,
          sub: `${fmtInt(d.revenue.data.internal_orders_all)} orders paid by internal/test accounts · ${fmtInt(d.revenue.data.internal_granted_unpaid)} accesses granted without payment`,
          caveat: "Team test payments (prices below list, same account): they are not revenue and do not enter any total. Shown only so they do not disappear.",
        }
      : errorTile("Internal/test cash Paygate + PayPal (total)", ALL),
    d.shopify.ok && has(d.shopify.data, "refunds_w", "refunds_all", "internal_orders_all")
      ? {
          label: "Paid Shopify orders",
          status: "LIVE",
          value: fmtInt(d.shopify.data.orders_w),
          window: W,
          sub: `${fmtInt(d.shopify.data.refunds_w)} refunds in the window · all time: ${fmtInt(d.shopify.data.orders_all)} orders, ${fmtInt(d.shopify.data.refunds_all)} refunds · amount ${d.shopify.data.amount_w.toLocaleString(LOCALE, { minimumFractionDigits: 2 })} in the window, unknown currency · ${fmtInt(d.shopify.data.internal_orders_all)} internal/test orders excluded`,
          caveat: "One orders/paid order per order id (the webhook drops repeats), excluding orders from internal/test accounts. Refunds = refunds/create events, counted apart and not subtracted. Unknown currency: the DB does not record the store currency, so the amount is not added to the USD.",
        }
      : errorTile("Paid Shopify orders", W),
    revOk && d.revenue.ok
      ? {
          label: "Annual share",
          status: "LIVE",
          value: d.revenue.data.orders_all < MIN_ORDERS_FOR_SHARE ? "n/a" : formatPct(ratio(d.revenue.data.annual_all, d.revenue.data.orders_all), 0),
          window: ALL,
          sub:
            d.revenue.data.orders_all < MIN_ORDERS_FOR_SHARE
              ? `sample of ${fmtInt(d.revenue.data.orders_all)} external paid orders, below ${MIN_ORDERS_FOR_SHARE}: no percentage`
              : `${fmtInt(d.revenue.data.annual_all)} annual of ${fmtInt(d.revenue.data.orders_all)} external paid orders`,
          caveat: `Paygate and PayPal only (period), excluding orders from internal/test accounts. Shopify and Stripe do not record the period here. With fewer than ${MIN_ORDERS_FOR_SHARE} external orders the share says nothing: n/a.`,
        }
      : errorTile("Annual share", ALL),
    fromResult(d.funnelEvents, "Partner clicks (affiliate)", W, (f) => ({
      status: "LIVE",
      value: fmtInt(f.partner_click),
      sub: `${fmtInt(f.partner_menu_open)} menu opens · clicks/opens: ${formatShare(f.partner_click, f.partner_menu_open, "clicks > opens: incomplete tracking")}`,
      caveat: "Outbound clicks only: partner conversions do not come back to us. Clicks can also come from outside the menu (or the open may not be recorded), so the clicks/opens ratio is never shown above 100%: in that case it is n/a.",
    })),
  ];

  // ── Retention ──
  const retention: TileProps[] = [
    proxy("Lapsed paid subscriptions", W, d.lapsed, (l) => ({
      value: fmtInt(Number(l.lapsed)),
      caveat: "Profiles from a paid channel with plan_expires_at in the window and not renewed, excluding internal/test accounts. It is a count of expiries, not a churn rate.",
    })),
  ];

  // ── Product quality ──
  const quality: TileProps[] = [
    fromResult(d.calibration, "Brier (served)", CAL_WINDOW, (c) => ({
      status: "LIVE",
      value: c.brier === null ? null : fmtDec(c.brier),
      sub: `${fmtInt(c.matches)} closed matches, one prediction per match · ${marketLine(c)} · «1/3 to each outcome» reference = ${fmtDec(BRIER_UNIFORM_3WAY, 3)} · lower is better`,
      caveat: `Internal quality figure, not a marketing claim. For each closed match only the last prediction computed before kickoff counts (prediction_log stores dozens per match: counting them all gave more weight to the matches updated more often). Brier = sum of the squared errors over the 3 outcomes (home/draw/away), 0–2 scale, then the mean over the matches. The market (market probabilities stored with the prediction) is measured on the same matches where it exists. ${verdict(c)} It does not depend on the selected window.`,
    })),
    fromResult(d.calibration, "ECE (served)", CAL_WINDOW, (c) => ({
      status: "LIVE",
      value: c.ece === null ? null : fmtDec(c.ece),
      sub: `mean calibration error, 10 bins · ${fmtInt(c.matches)} matches, one prediction per match`,
      caveat: "Mean over home/draw/away of |predicted probability − observed frequency|, on the same one prediction per match as the Brier (the last one before kickoff).",
    })),
    proxy("Odds freshness", NOW, d.freshness, (f) => ({
      value: formatAge(f.odds_age_s),
      sub: "age of the last saved odds",
      caveat: "Freshness, not latency: it says when we saved the last odds, not how far behind the bookmaker we are.",
    })),
    fromResult(d.freshness, "Football predictions freshness", NOW, (f) => ({
      status: "LIVE",
      value: formatAge(f.football_age_s),
      caveat: "Age of the latest computed_at in match_predictions (control tower threshold: 4h).",
    })),
    fromResult(d.freshness, "Tennis predictions freshness", NOW, (f) => ({
      status: "LIVE",
      value: formatAge(f.tennis_age_s),
      caveat: "Age of the latest computed_at in tennis_predictions (control tower threshold: 6h).",
    })),
    d.funnelEvents.ok && !has(d.funnelEvents.data, "client_error_dedup")
      ? errorTile("Client errors", W)
      : fromResult(d.funnelEvents, "Client errors", W, (f) => ({
          status: "LIVE",
          value: fmtInt(f.client_error_dedup),
          sub: `${fmtInt(f.client_error)} raw events · ${fmtInt(f.client_error - f.client_error_dedup)} duplicates within ${CLIENT_ERROR_DEDUP_SECONDS} s not counted`,
          caveat: `client_error events from the global boundary, deduplicated: two identical errors (same session — or both without a session —, same message, digest and page) ${CLIENT_ERROR_DEDUP_SECONDS} seconds or less apart count once (the boundary often sends them twice). Includes crawlers and bots: it is a count of errors, not of affected users.`,
        })),
  ];

  const families: { family: Family; tiles: TileProps[] }[] = [
    { family: "acquisition", tiles: acquisition },
    { family: "activation", tiles: activation },
    { family: "revenue", tiles: revenue },
    { family: "retention", tiles: retention },
    { family: "quality", tiles: quality },
  ];
  const allTiles = families.flatMap((f) => f.tiles);
  const errorCount = allTiles.filter((t) => t.status === "ERRORE").length;
  const byLabel = new Map(allTiles.map((t) => [t.label, t]));
  const primary = PRIMARY.map((l) => byLabel.get(l)!);
  const paired = byLabel.get(PAIRED)!;
  const isPrimary = (t: TileProps) => (PRIMARY as readonly string[]).includes(t.label) || t.label === PAIRED;

  // The work content is versioned in content/: read here only to group the
  // missing KPI by gap and to count the open gaps in the bar (no I/O at runtime).
  const gaps = validateGaps(gapsJson);
  const openGaps = gaps.filter((g) => g.status !== "closed").length;

  const serviceLine = isSnapshot
    ? `Snapshot of ${updated} (Rome time) · not live · the windows count back from that moment`
    : `Read at ${updatedTime} (Rome time)${meta.cacheTtlS ? ` · the same read is valid for ${meta.cacheTtlS / 60} min` : " · read on this page load"}`;

  const navItems: { href: string; label: string; n?: number }[] = [
    { href: "#today", label: "Today in 30 seconds" },
    { href: "#stage-counts", label: "Stage counts" },
    { href: "#main-kpis", label: "Main KPIs", n: primary.length },
    ...families.map((f) => ({ href: `#${FAMILY_ID[f.family]}`, label: FAMILY_LABEL[f.family], n: f.tiles.length })),
    { href: "#channels", label: "Channels" },
    { href: "#trends", label: "Trends" },
    { href: "#missing", label: "Data we do not have yet", n: MISSING_KPIS.length },
  ];

  return (
    <div className="g-page">
      <header className="g-wrap">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3 order-1">
            <a href={hrefFor(w)} aria-label="BetRedge Growth, back to top" className="inline-flex" style={{ color: "var(--lockup-ink)" }}>
              <Lockup className="h-8 w-auto" />
            </a>
            <span className="g-eyebrow hidden sm:inline">Growth · read only</span>
          </div>
          <div className="flex flex-col gap-1 order-3 md:order-2 basis-full md:basis-auto">
            <nav className="g-seg" aria-label="Time window">
              {WINDOWS.map((x) => (
                <a key={x.key} href={hrefFor(x.key)} aria-current={x.key === w ? "page" : undefined}>
                  {x.label}
                </a>
              ))}
            </nav>
            <span className="g-meta hidden md:block">Today = Rome calendar day up to {updatedTime} · 7 and 30 days = back from that moment</span>
          </div>
          <p role="status" className="g-meta order-4 md:order-3 basis-full md:basis-auto md:max-w-[34ch]">
            {serviceLine}
            {!isSnapshot && (
              <>
                {" "}
                · <a href={hrefFor(w)}>reload</a>
              </>
            )}
          </p>
          <div className="ml-auto flex items-center gap-4 order-2 md:order-4">
            {workHref && (
              <a href={workHref} className="text-[14px] font-semibold whitespace-nowrap inline-flex items-center min-h-[44px]">
                {/* flex container: plain spaces at the edge of an item collapse, hence the no-break spaces */}
                Work · {fmtInt(openGaps)}
                <span className="hidden sm:inline">{"\u00a0"}open gaps</span>
                {"\u00a0"}→
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="g-wrap">
        <div className="g-body">
          <nav className="g-nav g-nav--side" aria-label="Sections">
            {navItems.map((i) => (
              <a key={i.href} href={i.href}>
                {i.label}
                {i.n !== undefined && <span className="n">{i.n}</span>}
              </a>
            ))}
            <div className="g-nav-legend" aria-hidden="true">
              <Chip mark="LIVE" />
              <Chip mark="PROXY" />
              <Chip mark="EST" />
              <Chip mark="ERRORE" />
              <Chip mark="MANCA" />
            </div>
          </nav>
          <details className="g-why md:hidden -mb-2">
            <summary>
              Go to a section <span className="g-caret" aria-hidden="true">▸</span>
            </summary>
            <nav className="g-nav g-why-body" aria-label="Sections">
              {navItems.map((i) => (
                <a key={i.href} href={i.href}>
                  {i.label}
                  {i.n !== undefined && <span className="n">{i.n}</span>}
                </a>
              ))}
            </nav>
          </details>

          <main className="g-main">
            <Today
              data={d}
              windowLabel={W}
              errorCount={errorCount}
              noSessShare={noSessShare}
              snapshotLabel={isSnapshot ? updated : undefined}
              missingCount={MISSING_KPIS.length}
              missingHref="#missing"
            />

            <section aria-labelledby="stage-counts" className="flex flex-col gap-3">
              <SectionTitle id="stage-counts" title="Stage counts" hint={`different units, users not linked · ${W}`}>
                <Chip mark="PROXY" />
              </SectionTitle>
              {!funnelOk ? (
                <div className="g-card p-4 text-[14px]" style={ERR_STYLE}>
                  <Chip mark="ERRORE" /> Reading the counts failed — no value shown.
                </div>
              ) : (
                <div className="g-card p-4 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {funnelSteps.map((s, i) => (
                      <div
                        key={s.label}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-1 gap-x-4 gap-y-0.5 items-center sm:items-start py-2.5 sm:py-1 sm:px-4 ${i > 0 ? "border-t sm:border-t-0 sm:border-l [border-color:var(--line)]" : ""}`}
                        data-step
                      >
                        <span className="g-label sm:order-1">{s.label}</span>
                        <span className="g-num g-num--lg row-span-2 sm:row-span-1 sm:order-2 sm:my-1" data-kpi={s.label} data-value={fmtInt(s.value)}>
                          {fmtInt(s.value)}
                        </span>
                        <span className="g-meta sm:order-3">{s.unit}</span>
                      </div>
                    ))}
                  </div>
                  <Why label="why it is not a funnel">
                    The steps have different units (consented sessions → events → DB rows → orders) and are not tied to the same person: no arrows and no
                    conversion percentage, a step can be bigger than the previous one without it being an error. {sessCaveat} Orders also count renewals by
                    existing customers; Stripe records no orders with an amount in the DB. Conversions will come back when a stable user id exists (G01 in Work).
                  </Why>
                </div>
              )}
            </section>

            <section aria-labelledby="main-kpis" className="flex flex-col gap-3">
              <SectionTitle id="main-kpis" title="Main KPIs" hint={`the six numbers to start from · ${W}`} />
              <Why label="status legend">
                <ul className="flex flex-col gap-1.5">
                  <li>
                    <Chip mark="LIVE" /> {MARK_LABEL.LIVE}: counted from the DB, it means what the label says.
                  </li>
                  <li>
                    <Chip mark="PROXY" /> {MARK_LABEL.PROXY}: counted from the DB, but it approximates the KPI: «why ▸» says how and what will make it real.
                  </li>
                  <li>
                    <Chip mark="EST" /> {MARK_LABEL.EST}: deduced with a declared criterion, never observed; the raw number always stays next to it.
                  </li>
                  <li>
                    <Chip mark="ERRORE" /> {MARK_LABEL.ERRORE}: the read failed; the value is missing, it is not replaced with 0.
                  </li>
                  <li>
                    <Chip mark="MANCA" />: the data does not exist yet in any source; never in the place of a number, listed in «Data we do not have yet».
                  </li>
                </ul>
              </Why>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {primary.map((t) => (
                  <PrimaryCard key={t.label} t={t} pair={t.label === PRIMARY[0] ? paired : undefined} />
                ))}
              </div>
            </section>

            {families.map(({ family, tiles }) => (
              <section key={family} aria-labelledby={FAMILY_ID[family]} className="flex flex-col gap-3">
                <SectionTitle
                  id={FAMILY_ID[family]}
                  title={FAMILY_LABEL[family]}
                  hint={
                    family === "acquisition" && d.humanTraffic.ok
                      ? `${FAMILY_HINT[family]} · ${W}: ${fmtInt(d.humanTraffic.data.probably_human)} probably human page views (≈ Estimated) · ${fmtInt(d.humanTraffic.data.page_views)} raw (● Counted)`
                      : FAMILY_HINT[family]
                  }
                />
                <SecondaryRows tiles={tiles.filter((t) => !isPrimary(t))} missing={missingLabels(family)} />
                {tiles.filter((t) => !isPrimary(t)).length === 0 && <p className="g-meta">All the measured KPIs of this section are among the main ones.</p>}
              </section>
            ))}

            <section aria-labelledby="channels" className="flex flex-col gap-3">
              <SectionTitle id="channels" title="Channels" hint={`sources, entries, sessions and signups · ${W} · each table states its unit`} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <SmallTable
                  title="Entries by source"
                  mark="LIVE"
                  caveat="Entry page views by source (utm_source, then src/crm/ref/referrer), with and without consent. Entry pages, not people; crawlers included, internal/test sources excluded (row below). Referrers cut to the domain, referral codes masked."
                  rows={topEntries(d.entries)}
                  cols={[{ h: "Source", get: (r) => sourceLabel(r.source) }, { h: "Entries", get: (r) => fmtInt(Number(r.entries)), right: true }]}
                  empty="No entry page view with a source in the window."
                  footer={d.entries.ok && <InternalFooter n={splitEntries(d.entries.data).internal} />}
                />
                <SmallTable
                  title="Sessions by source"
                  mark="PROXY"
                  caveat={`One source per session (utm_source, then src/crm/ref/referrer of the entry page_view). ${sessCaveat} Top ${SOURCE_ROWS_SHOWN}, the rest in one row. «(no source)» is an explicit row, not a hidden entry. Internal/test sources excluded with the same rule as the entries (row below).`}
                  rows={topSources(d.sources)}
                  cols={[{ h: "Source", get: (r) => sourceLabel(r.source) }, { h: "Sessions", get: (r) => fmtInt(Number(r.sessions)), right: true }]}
                  empty="No consented session in the window."
                  footer={d.sources.ok && <InternalFooter n={splitFolded(d.sources.data, (r) => r.source, (r) => r.sessions).internal} />}
                />
                <SmallTable
                  title="New signups by channel"
                  mark="LIVE"
                  caveat="profiles.acquisition of the profiles created in the window. «(not recorded)» = profile without acquisition data: the product stores it only with cookie consent, so a signup without consent stays like that (and so are the profiles created before attribution existed). Internal/test sources excluded with the same rule as the entries (row below)."
                  rows={d.channels.ok ? { ok: true, data: splitFolded(d.channels.data, (r) => r.channel, (r) => r.n).external } : d.channels}
                  cols={[{ h: "Channel", get: (r) => sourceLabel(r.channel) }, { h: "Signups", get: (r) => fmtInt(Number(r.n)), right: true }]}
                  empty="No new profile in the window."
                  footer={d.channels.ok && <InternalFooter n={splitFolded(d.channels.data, (r) => r.channel, (r) => r.n).internal} />}
                />
                <SmallTable
                  title="Widget on partner sites"
                  mark="LIVE"
                  caveat="widget_view / widget_click by host declared by the widget. localhost and *.vercel.app previews excluded."
                  rows={d.widget}
                  cols={[
                    { h: "Host", get: (r) => r.host },
                    { h: "Views", get: (r) => fmtInt(Number(r.views)), right: true },
                    { h: "Clicks", get: (r) => fmtInt(Number(r.clicks)), right: true },
                  ]}
                  empty="No widget view in the window."
                />
                <SmallTable
                  title="Clicks by partner"
                  mark="LIVE"
                  caveat="partner_click events by partner_id in the window. Top 10."
                  rows={d.partners}
                  cols={[{ h: "Partner", get: (r) => r.partner_id }, { h: "Clicks", get: (r) => fmtInt(Number(r.clicks)), right: true }]}
                  empty="No partner click in the window."
                />
              </div>
              <Channels data={d} />
            </section>

            <Trends data={d} />

            <MissingData gaps={gaps} workHref={workHref} />

            {spike?.spike && d.humanTraffic.ok && (
              <p className="g-meta sr-only">
                Anomalous spike: {formatPct(spike.share, 0)} of the page views ({W}) have no country, threshold {formatPct(NO_COUNTRY_SPIKE_SHARE, 0)}.
              </p>
            )}

            <p className="g-meta pb-6">
              Source: {meta.origin}. Aggregates only, no personal data (referrers cut to the domain, referral codes masked). Definitions in core/sql.ts.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
