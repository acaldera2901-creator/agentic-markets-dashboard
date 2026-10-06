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
import { type EntryRow, HUMAN_FILTER_CRITERIA, INTERNAL_REFERRER_RULE, NO_COUNTRY_SPIKE_SHARE, noCountrySpike, splitEntries } from "@/core/estimate";
import type { GrowthData, Result, SourceMeta } from "@/core/model";
import gapsJson from "@/content/tracking-gaps.json";
import { Lockup } from "./brand/Lockup";
import { Chip, LockIcon, MARK_LABEL, type Mark, SectionTitle, Why, fmtInt } from "./primitives";
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
  /** Optional link to the work page (/lavoro in the standalone app); omitted → no link. */
  workHref?: string;
}

// ─── Tile model (unchanged from v5) ─────────────────────────────────────────

interface TileProps {
  label: string;
  status: KpiStatus;
  /** Badge text instead of the status name (e.g. STIMATO on a PROXY estimate). */
  badge?: string;
  /** null for LIVE/PROXY means "not computable" (denominator 0, empty table) — rendered as n/d, never 0. */
  value?: string | null;
  sub?: string;
  window: string;
  caveat: string;
  needs?: string;
  owner?: string;
}

function errorTile(label: string, window: string): TileProps {
  return { label, status: "ERRORE", window, caveat: "La query è fallita: riprova a ricaricare. Il valore non viene sostituito con 0." };
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
  return { label, window, status: "PROXY", ...t, caveat: `Approssima «${p.pdfKpi}». ${t.caveat}`, needs: `${p.needs} — ${p.gaps.join(", ")} in /lavoro`, owner: p.owner };
}

/** A field a query should return; absent (older snapshot) → the tile is ERRORE, never 0. */
const has = (o: Record<string, number>, ...keys: string[]) => keys.every((k) => Number.isFinite(o[k]));

const ENTRY_ROWS_SHOWN = 20;

function entriesTile(d: GrowthData, window: string): TileProps {
  return fromResult(d.entries, "Ingressi con fonte", window, (rows) => {
    const { external, internal } = splitEntries(rows);
    const withSource = external.reduce((s, r) => s + r.entries, 0);
    const pv = d.traffic.ok ? d.traffic.data.page_views : null;
    const noSource = pv === null ? null : pv - withSource - internal;
    return {
      status: "LIVE",
      value: fmtInt(withSource),
      sub:
        (noSource === null
          ? "page view senza fonte: n/d (lettura dei page view fallita)"
          : `page view senza nessuna fonte: ${fmtInt(noSource)} su ${fmtInt(pv!)} (${formatPct(ratio(noSource, pv!), 0) ?? "n/d"})`) +
        ` · interni (esclusi): ${fmtInt(internal)}`,
      caveat: `Page view d'ingresso con utm_source, src, crm, ref o referrer esterno (ridotto al dominio), registrati anche senza consenso. Conta pagine d'ingresso, non persone: una ricarica conta due volte, crawler e test inclusi. Esclusi gli ingressi da nostre anteprime: ${INTERNAL_REFERRER_RULE}. La quota senza fonte è sui page view, non sugli ingressi: un ingresso diretto non si distingue da una pagina successiva (il tracker non marca l'ingresso), quindi è un limite superiore.`,
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
    data: [...r.data.slice(0, ENTRY_ROWS_SHOWN - 1), { source: `(altre ${rest.length} fonti)`, entries: rest.reduce((s, x) => s + x.entries, 0) }],
  };
}

const fmtUsd = (n: number) => `$${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Rendering pieces ───────────────────────────────────────────────────────

/** The chip a tile wears: PROXY with the STIMATO badge is the estimate mark. */
const markOf = (t: TileProps): Mark => (t.status === "PROXY" && t.badge === "STIMATO" ? "EST" : t.status);

const ERR_STYLE: CSSProperties = { color: "var(--s-err)" };

function ValueLine({ t, size }: { t: TileProps; size: "lg" | "md" | "sm" }) {
  if (t.status === "ERRORE") {
    return (
      <span className="text-[14px] font-semibold" style={ERR_STYLE} data-kpi={t.label} data-value="lettura fallita">
        Lettura fallita — nessun valore mostrato
      </span>
    );
  }
  if (t.value === null || t.value === undefined) {
    return (
      <span data-kpi={t.label} data-value="n/d">
        <span className={`g-num g-num--${size === "lg" ? "md" : "sm"}`}>n/d</span>
        <span className="g-meta block">non calcolabile: niente su cui dividere</span>
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
        <b>Finestra:</b> {t.window}
      </p>
      {t.needs && (
        <p className="mt-1">
          <b>Serve:</b> {t.needs}
          {t.owner && (
            <>
              {" "}
              · <b>sblocca:</b> {t.owner}
            </>
          )}
        </p>
      )}
    </>
  );
}

/** One of the six big KPI: number, mark, the raw count next to the estimate, «perché ▸». */
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
            <span className="g-meta">grezzi</span>
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
          grezzi: {pair.sub}
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
        <span>Metrica</span>
        <span>Valore</span>
        <span>Stato</span>
        <span>Finestra</span>
        <span className="text-right">perché</span>
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
              perché <span className="g-caret" aria-hidden="true">▸</span>
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
              Non misurato in questa sezione: {missing.join(" · ")} → <a href="#mancanti">Dati che non abbiamo ancora</a>
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
          Lettura fallita — nessun valore mostrato
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
const PRIMARY = ["Page view probabilmente umani", "Sessioni", "Signup completati", "Nuovi profili", "Paganti verificati", "Incassato Paygate + PayPal"] as const;
const PAIRED = "Page view (grezzi)";

const FAMILY_HINT: Record<Family, string> = {
  acquisition: "da dove arrivano",
  activation: "chi si iscrive e inizia a usarlo",
  revenue: "chi paga e quanto",
  retention: "chi resta",
  quality: "il prodotto regge?",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export function GrowthDashboard({ data: d, meta, hrefFor, workHref }: GrowthDashboardProps) {
  const w = d.window;
  const W = windowLabel(w);
  const isSnapshot = meta.kind === "snapshot";
  const NOW = isSnapshot ? "al momento dello snapshot" : "adesso (istantanea)";
  const ALL = "da sempre (cumulato)";

  const updated = new Date(meta.asOf).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium" });
  const updatedTime = new Date(meta.asOf).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

  // Share of page_views without session_id in THIS window (measured, not assumed).
  const noSessShare = d.traffic.ok ? formatPct(ratio(d.traffic.data.page_views_no_session, d.traffic.data.page_views), 0) : null;
  // Page views without country in THIS window: above NO_COUNTRY_SPIKE_SHARE the totals are flagged.
  const spike = d.humanTraffic.ok ? noCountrySpike(d.humanTraffic.data.excl_no_country, d.humanTraffic.data.page_views) : null;
  const sessCaveat = `Solo traffico con consenso GDPR: ${noSessShare ?? "una parte"} dei page_view nella finestra non ha session_id e non è contato qui.`;

  // ── Conteggi delle fasi (was «Funnel»: same four counts, no arrows, no rates) ──
  const { traffic, funnelEvents, newProfiles, revenue: rev, shopify } = d;
  const funnelOk = traffic.ok && funnelEvents.ok && newProfiles.ok && rev.ok && shopify.ok;
  const funnelSteps =
    traffic.ok && funnelEvents.ok && newProfiles.ok && rev.ok && shopify.ok
      ? [
          { label: "Visitatori", value: traffic.data.sessions, unit: "sessioni con consenso" },
          { label: "Signup avviati", value: funnelEvents.data.signup_started, unit: "eventi signup_started" },
          { label: "Profili creati", value: newProfiles.data.new_profiles, unit: "righe profiles (DB)" },
          { label: "Ordini pagati", value: rev.data.orders_w + shopify.data.orders_w, unit: "Paygate + PayPal + Shopify" },
        ]
      : [];

  // ── Acquisition ──
  const acquisition: TileProps[] = [
    fromResult(d.humanTraffic, "Page view probabilmente umani", W, (h) => ({
      status: "PROXY",
      badge: "STIMATO",
      value: fmtInt(h.probably_human),
      sub: `su ${fmtInt(h.page_views)} grezzi · esclusi: ${fmtInt(h.excl_no_country)} senza paese, ${fmtInt(h.excl_country)} da paesi senza sessioni, ${fmtInt(h.excl_burst)} in raffica`,
      caveat: `STIMATO, non misurato: nei dati non c'è user-agent, quindi «non umano» è dedotto, mai osservato. Criterio (classi esclusive, in quest'ordine): ${HUMAN_FILTER_CRITERIA.map((c, i) => `${i + 1}) ${c}`).join("; ")}. Il numero grezzo resta accanto, «Page view (grezzi)».`,
      needs: "user-agent letto (senza salvarlo) e filtro bot in /api/track — leva 2 di #SESSIONI-1006",
      owner: "Calde",
    })),
    fromResult(d.traffic, "Page view (grezzi)", W, (t) => ({
      status: "LIVE",
      value: fmtInt(t.page_views),
      sub: `${fmtInt(t.page_views_no_session)} senza session_id (${noSessShare ?? "n/d"})${spike?.share != null ? ` · ${formatPct(spike.share, 0)} senza paese` : ""}`,
      caveat: "Tutti i page_view registrati, con e senza consenso: crawler, job sintetici e traffico senza paese inclusi. Il numero da leggere per le persone è «Page view probabilmente umani» (STIMATO).",
    })),
    entriesTile(d, W),
    proxy("Sessioni", W, d.traffic, (t) => ({ value: fmtInt(t.sessions), caveat: `Tutte le fonti, non solo l'organico. ${sessCaveat}` })),
    proxy("Sessioni /tools", W, d.traffic, (t) => ({
      value: fmtInt(t.tools_sessions),
      caveat: `Sessioni con almeno un page_view su /tools* (anche con prefisso lingua). ${sessCaveat}`,
    })),
    proxy("Sessioni /predictions", W, d.traffic, (t) => ({
      value: fmtInt(t.predictions_sessions),
      caveat: `Sessioni con almeno un page_view su /predictions* (pagine partita incluse). ${sessCaveat}`,
    })),
    fromResult(d.newProfiles, "Nuovi signup con referral", W, (p) => ({
      status: "LIVE",
      value: fmtInt(p.referred),
      sub: `su ${fmtInt(p.new_profiles)} nuovi profili`,
      caveat: "Profili creati nella finestra con referred_by valorizzato (creator / invito).",
    })),
  ];

  // ── Activation ──
  const activation: TileProps[] = [
    fromResult(d.newProfiles, "Nuovi profili", W, (p) => ({
      status: "LIVE",
      value: fmtInt(p.new_profiles),
      caveat: "Righe create in profiles nella finestra. Include eventuali account di test del team.",
    })),
    fromResult(d.newProfiles, "Account attivati", W, (p) => ({
      status: "LIVE",
      value: p.new_profiles > 0 ? `${fmtInt(p.activated)} / ${fmtInt(p.new_profiles)}` : null,
      sub: formatPct(ratio(p.activated, p.new_profiles), 0) ?? undefined,
      caveat: "Profili creati nella finestra con activated_at valorizzato (link di attivazione cliccato).",
    })),
    d.newProfiles.ok && has(d.newProfiles.data, "signups")
      ? {
          label: "Signup completati",
          status: "LIVE",
          value: fmtInt(d.newProfiles.data.signups),
          window: W,
          sub: d.funnelEvents.ok
            ? `tracking client: ${fmtInt(d.funnelEvents.data.signup_completed)} eventi signup_completed, ${fmtInt(d.funnelEvents.data.signup_started)} signup_started (${fmtInt(d.funnelEvents.data.signup_no_session)} senza sessione)`
            : "eventi di tracking: lettura fallita",
          caveat: "Profili creati dal form di registrazione nella finestra (unico inserimento che registra l'accettazione dei termini; esclusi gli account creati a mano). Gli eventi client possono perdersi o duplicarsi: qui servono solo a misurare il tracking.",
        }
      : errorTile("Signup completati", W),
    fromResult(d.funnelEvents, "Pop-up iscrizione", W, (f) => ({
      status: "LIVE",
      value: `${fmtInt(f.popup_shown)} mostrati`,
      sub: `${fmtInt(f.popup_cta)} click CTA · ${fmtInt(f.popup_dismissed)} chiusi`,
      caveat: "Eventi signup_popup_*: misurano il pop-up, non le iscrizioni che ne derivano.",
    })),
    fromResult(d.funnelEvents, "Intento d'acquisto", W, (f) => ({
      status: "LIVE",
      value: `${fmtInt(f.plan_view)} → ${fmtInt(f.plan_cta_click)} → ${fmtInt(f.checkout_opened)}`,
      sub: "plan_view → plan_cta_click → checkout_opened",
      caveat: "Conteggi di eventi, non di persone: una persona può generarne più d'uno.",
    })),
    proxy("Card aperte per sessione", W, d.funnelEvents, (f) => ({
      value: f.card_open_sessions > 0 ? (f.card_open / f.card_open_sessions).toFixed(1) : null,
      sub: `${fmtInt(f.card_open)} card_open in ${fmtInt(f.card_open_sessions)} sessioni`,
      caveat: "Engagement anonimo, non per utente: card_open per sessione che ne ha aperta almeno una.",
    })),
  ];

  // ── Revenue ──
  const paying = d.plans.ok ? splitPaying(d.plans.data) : null;
  const revenue: TileProps[] = [
    paying
      ? {
          label: "Paganti verificati",
          status: "LIVE",
          value: fmtInt(paying.verified),
          sub: `a parte, non paganti: ${fmtInt(paying.comp)} omaggio/manuali/senza fonte · ${fmtInt(paying.expiredNotSwept)} scaduti non ancora declassati (base/premium in tutto: ${fmtInt(paying.inclComp)})`,
          window: NOW,
          caveat: "Piano base/premium da un canale a pagamento (Paygate, PayPal, Shopify, Stripe) e non scaduto. Gli account omaggio e quelli scaduti sono contati a parte e non entrano nel numero.",
        }
      : errorTile("Paganti verificati", NOW),
    paying
      ? {
          label: "Free",
          status: "LIVE",
          value: fmtInt(paying.free),
          sub: `${fmtInt(paying.team)} account team (admin_full) esclusi`,
          window: NOW,
          caveat: "Profili con plan = free. Include account di test.",
        }
      : errorTile("Free", NOW),
    fromResult(d.revenue, "Incassato Paygate + PayPal", W, (r) => ({
      status: "LIVE",
      value: fmtUsd(r.usd_w),
      sub: `${fmtInt(r.orders_w)} ordini nella finestra`,
      caveat: "Somma amount_usd degli ordini con paid_at nella finestra. Stripe non salva importi nel DB: escluso.",
    })),
    fromResult(d.revenue, "Incassato Paygate + PayPal (totale)", ALL, (r) => ({
      status: "LIVE",
      value: fmtUsd(r.usd_all),
      sub: `${fmtInt(r.orders_all)} ordini pagati`,
      caveat: `Stessa regola della torre (paid_at valorizzato). ${fmtInt(r.granted_unpaid)} accessi concessi senza pagamento registrato: non sommati.`,
    })),
    d.shopify.ok && has(d.shopify.data, "refunds_w", "refunds_all")
      ? {
          label: "Ordini Shopify pagati",
          status: "LIVE",
          value: fmtInt(d.shopify.data.orders_w),
          window: W,
          sub: `${fmtInt(d.shopify.data.refunds_w)} rimborsi nella finestra · da sempre: ${fmtInt(d.shopify.data.orders_all)} ordini, ${fmtInt(d.shopify.data.refunds_all)} rimborsi · importo ${d.shopify.data.amount_w.toLocaleString("it-IT", { minimumFractionDigits: 2 })} nella finestra (valuta del negozio)`,
          caveat: "Un ordine orders/paid per order id (il webhook scarta le ripetizioni). Rimborsi = eventi refunds/create, contati a parte e non sottratti. L'importo è nella valuta del negozio, che il DB non registra: non si somma agli USD.",
        }
      : errorTile("Ordini Shopify pagati", W),
    fromResult(d.revenue, "Quota annuale", ALL, (r) => ({
      status: "LIVE",
      value: formatPct(ratio(r.annual_all, r.orders_all), 0),
      sub: `${fmtInt(r.annual_all)} annuali su ${fmtInt(r.orders_all)} ordini pagati`,
      caveat: "Solo Paygate e PayPal (period). Shopify e Stripe non registrano il periodo qui. Campione piccolo.",
    })),
    fromResult(d.funnelEvents, "Click partner (affiliate)", W, (f) => ({
      status: "LIVE",
      value: fmtInt(f.partner_click),
      sub: `${fmtInt(f.partner_menu_open)} aperture menu · click/aperture: ${formatShare(f.partner_click, f.partner_menu_open, "click > aperture: tracking incompleto")}`,
      caveat: "Solo click in uscita: le conversioni del partner non tornano a noi. I click possono arrivare anche fuori dal menu (o l'apertura non essere registrata), quindi il rapporto click/aperture non viene mai mostrato sopra il 100%: in quel caso è n/d.",
    })),
  ];

  // ── Retention ──
  const retention: TileProps[] = [
    proxy("Abbonamenti pagati scaduti", W, d.lapsed, (l) => ({
      value: fmtInt(Number(l.lapsed)),
      caveat: "Profili da canale a pagamento con plan_expires_at nella finestra e non rinnovati. È un conteggio di scadenze, non un churn rate.",
    })),
  ];

  // ── Product quality ──
  const quality: TileProps[] = [
    fromResult(d.calibration, "Brier (servito)", "ultimi 20.000 pronostici chiusi", (c) => ({
      status: "LIVE",
      value: c.brier === null ? null : c.brier.toFixed(4),
      sub: `n = ${fmtInt(c.n)} · somma sui 3 esiti (casa/pareggio/trasferta), scala 0–2 · riferimento «1/3 a ogni esito» = ${BRIER_UNIFORM_3WAY.toLocaleString("it-IT", { maximumFractionDigits: 3 })} · più basso è meglio`,
      caveat: "Stessa definizione di /api/research/calibration (blocco served): per ogni pronostico la somma dei quadrati degli errori sui 3 esiti, poi la media. Non dipende dalla finestra selezionata.",
    })),
    fromResult(d.calibration, "ECE (servito)", "ultimi 20.000 pronostici chiusi", (c) => ({
      status: "LIVE",
      value: c.ece === null ? null : c.ece.toFixed(4),
      sub: "errore di calibrazione medio, 10 bin",
      caveat: "Media su casa/pareggio/trasferta di |probabilità prevista − frequenza osservata|.",
    })),
    proxy("Freschezza quote", NOW, d.freshness, (f) => ({
      value: formatAge(f.odds_age_s),
      sub: "età dell'ultima quota salvata",
      caveat: "Freschezza, non latenza: dice quando abbiamo salvato l'ultima quota, non quanto siamo in ritardo sul bookmaker.",
    })),
    fromResult(d.freshness, "Freschezza predizioni calcio", NOW, (f) => ({
      status: "LIVE",
      value: formatAge(f.football_age_s),
      caveat: "Età dell'ultimo computed_at in match_predictions (soglia torre: 4h).",
    })),
    fromResult(d.freshness, "Freschezza predizioni tennis", NOW, (f) => ({
      status: "LIVE",
      value: formatAge(f.tennis_age_s),
      caveat: "Età dell'ultimo computed_at in tennis_predictions (soglia torre: 6h).",
    })),
    fromResult(d.funnelEvents, "Errori client", W, (f) => ({
      status: "LIVE",
      value: fmtInt(f.client_error),
      caveat: "Eventi client_error dal boundary globale: schermate d'errore viste dagli utenti.",
    })),
    fromResult(d.freshness, "Pattern di errore server", "ultime 24h", (f) => ({
      status: "LIVE",
      value: fmtInt(f.error_patterns_24h),
      caveat: "Righe in error_patterns_log nelle ultime 24h (stessa lettura della torre).",
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
  const openGaps = gaps.filter((g) => g.status !== "chiuso").length;

  const serviceLine = isSnapshot
    ? `Snapshot del ${updated} (Roma) · non live · le finestre contano all’indietro da quell’istante`
    : `Letto alle ${updatedTime} (Roma)${meta.cacheTtlS ? ` · la stessa lettura vale ${meta.cacheTtlS / 60} min` : " · letto a questo caricamento"}`;

  const navItems: { href: string; label: string; n?: number }[] = [
    { href: "#oggi", label: "Oggi in 30 secondi" },
    { href: "#conteggi", label: "Conteggi delle fasi" },
    { href: "#principali", label: "KPI principali", n: primary.length },
    ...families.map((f) => ({ href: `#${FAMILY_ID[f.family]}`, label: FAMILY_LABEL[f.family], n: f.tiles.length })),
    { href: "#canali", label: "Canali" },
    { href: "#andamento", label: "Andamento" },
    { href: "#mancanti", label: "Dati che non abbiamo ancora", n: MISSING_KPIS.length },
  ];

  return (
    <div className="g-page">
      <header className="g-wrap">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3 order-1">
            <a href={hrefFor(w)} aria-label="BetRedge Growth, torna in cima" className="inline-flex" style={{ color: "var(--lockup-ink)" }}>
              <Lockup className="h-8 w-auto" />
            </a>
            <span className="g-eyebrow hidden sm:inline">Growth · sola lettura</span>
          </div>
          <div className="flex flex-col gap-1 order-3 md:order-2 basis-full md:basis-auto">
            <nav className="g-seg" aria-label="Finestra temporale">
              {WINDOWS.map((x) => (
                <a key={x.key} href={hrefFor(x.key)} aria-current={x.key === w ? "page" : undefined}>
                  {x.label}
                </a>
              ))}
            </nav>
            <span className="g-meta hidden md:block">Oggi = giorno di Roma fino alle {updatedTime} · 7 e 30 giorni = all’indietro da quell’istante</span>
          </div>
          <p role="status" className="g-meta order-4 md:order-3 basis-full md:basis-auto md:max-w-[34ch]">
            {serviceLine}
            {!isSnapshot && (
              <>
                {" "}
                · <a href={hrefFor(w)}>ricarica</a>
              </>
            )}
          </p>
          <div className="ml-auto flex items-center gap-4 order-2 md:order-4">
            {workHref && (
              <a href={workHref} className="text-[14px] font-semibold whitespace-nowrap inline-flex items-center min-h-[44px]">
                Lavoro · {fmtInt(openGaps)}
                <span className="hidden sm:inline"> gap aperti</span> →
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="g-wrap">
        <div className="g-body">
          <nav className="g-nav g-nav--side" aria-label="Sezioni">
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
              Vai a una sezione <span className="g-caret" aria-hidden="true">▸</span>
            </summary>
            <nav className="g-nav g-why-body" aria-label="Sezioni">
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
              missingHref="#mancanti"
            />

            <section aria-labelledby="conteggi" className="flex flex-col gap-3">
              <SectionTitle id="conteggi" title="Conteggi delle fasi" hint={`unità diverse, utenti non collegati · ${W}`}>
                <Chip mark="PROXY" />
              </SectionTitle>
              {!funnelOk ? (
                <div className="g-card p-4 text-[14px]" style={ERR_STYLE}>
                  <Chip mark="ERRORE" /> Lettura dei conteggi fallita — nessun valore mostrato.
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
                  <Why label="perché non è un funnel">
                    I passi hanno unità diverse (sessioni con consenso → eventi → righe DB → ordini) e non sono legati alla stessa persona: nessuna freccia e nessuna
                    percentuale di conversione, un passo può essere più grande del precedente senza che sia un errore. {sessCaveat} Gli ordini contano anche rinnovi di
                    clienti già esistenti; Stripe non registra ordini con importo nel DB. Le conversioni torneranno quando esisterà un id utente stabile (G01 in Lavoro).
                  </Why>
                </div>
              )}
            </section>

            <section aria-labelledby="principali" className="flex flex-col gap-3">
              <SectionTitle id="principali" title="KPI principali" hint={`i sei numeri da cui partire · ${W}`} />
              <Why label="legenda degli stati">
                <ul className="flex flex-col gap-1.5">
                  <li>
                    <Chip mark="LIVE" /> {MARK_LABEL.LIVE}: contato dal DB, significa quello che dice l’etichetta.
                  </li>
                  <li>
                    <Chip mark="PROXY" /> {MARK_LABEL.PROXY}: contato dal DB, ma approssima il KPI: «perché ▸» dice come e cosa lo renderà reale.
                  </li>
                  <li>
                    <Chip mark="EST" /> {MARK_LABEL.EST}: dedotto con un criterio dichiarato, mai osservato; il grezzo resta sempre accanto.
                  </li>
                  <li>
                    <Chip mark="ERRORE" /> {MARK_LABEL.ERRORE}: la lettura è fallita; il valore manca, non è sostituito con 0.
                  </li>
                  <li>
                    <Chip mark="MANCA" />: il dato non esiste ancora in nessuna fonte; mai nella posizione di un numero, elencato in «Dati che non abbiamo ancora».
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
                      ? `${FAMILY_HINT[family]} · ${W}: ${fmtInt(d.humanTraffic.data.probably_human)} page view probabilmente umani (≈ Stimato) · ${fmtInt(d.humanTraffic.data.page_views)} grezzi (● Contato)`
                      : FAMILY_HINT[family]
                  }
                />
                <SecondaryRows tiles={tiles.filter((t) => !isPrimary(t))} missing={missingLabels(family)} />
                {tiles.filter((t) => !isPrimary(t)).length === 0 && <p className="g-meta">Tutti i KPI misurati di questa sezione sono fra i principali.</p>}
              </section>
            ))}

            <section aria-labelledby="canali" className="flex flex-col gap-3">
              <SectionTitle id="canali" title="Canali" hint={`fonti, ingressi, sessioni e signup · ${W} · ogni tabella dichiara la sua unità`} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <SmallTable
                  title="Ingressi per fonte"
                  mark="LIVE"
                  caveat="Page view d'ingresso per fonte (utm_source, poi src/crm/ref/referrer), con e senza consenso. Pagine d'ingresso, non persone; crawler e test inclusi. Referrer ridotti al dominio, codici referral mascherati."
                  rows={topEntries(d.entries)}
                  cols={[{ h: "Fonte", get: (r) => r.source }, { h: "Ingressi", get: (r) => fmtInt(Number(r.entries)), right: true }]}
                  empty="Nessun page view d'ingresso con fonte nella finestra."
                  footer={
                    d.entries.ok && (
                      <div className="g-rule pt-2">
                        <div className="flex justify-between text-[14px] g-muted">
                          <span>interni (esclusi)</span>
                          <span className="g-tab">{fmtInt(splitEntries(d.entries.data).internal)}</span>
                        </div>
                        <div className="g-meta">Non sommati sopra: {INTERNAL_REFERRER_RULE}.</div>
                      </div>
                    )
                  }
                />
                <SmallTable
                  title="Sessioni per fonte"
                  mark="PROXY"
                  caveat={`Una fonte per sessione (utm_source, poi src/crm/ref/referrer del page_view d'ingresso). ${sessCaveat} Top 15. «(nessuna fonte)» è una riga esplicita, non una voce nascosta.`}
                  rows={d.sources}
                  cols={[{ h: "Fonte", get: (r) => r.source }, { h: "Sessioni", get: (r) => fmtInt(Number(r.sessions)), right: true }]}
                  empty="Nessuna sessione con consenso nella finestra."
                />
                <SmallTable
                  title="Nuovi signup per canale"
                  mark="LIVE"
                  caveat="profiles.acquisition dei profili creati nella finestra. «(non registrata)» = profilo senza dato di acquisizione (i profili storici sono tutti così)."
                  rows={d.channels}
                  cols={[{ h: "Canale", get: (r) => r.channel }, { h: "Signup", get: (r) => fmtInt(Number(r.n)), right: true }]}
                  empty="Nessun nuovo profilo nella finestra."
                />
                <SmallTable
                  title="Widget sui siti partner"
                  mark="LIVE"
                  caveat="widget_view / widget_click per host dichiarato dal widget. Esclusi localhost e anteprime *.vercel.app."
                  rows={d.widget}
                  cols={[
                    { h: "Host", get: (r) => r.host },
                    { h: "View", get: (r) => fmtInt(Number(r.views)), right: true },
                    { h: "Click", get: (r) => fmtInt(Number(r.clicks)), right: true },
                  ]}
                  empty="Nessuna visualizzazione del widget nella finestra."
                />
                <SmallTable
                  title="Click per partner"
                  mark="LIVE"
                  caveat="Eventi partner_click per partner_id nella finestra. Top 10."
                  rows={d.partners}
                  cols={[{ h: "Partner", get: (r) => r.partner_id }, { h: "Click", get: (r) => fmtInt(Number(r.clicks)), right: true }]}
                  empty="Nessun click partner nella finestra."
                />
              </div>
              <Channels data={d} />
            </section>

            <Trends data={d} />

            <MissingData gaps={gaps} workHref={workHref} />

            {spike?.spike && d.humanTraffic.ok && (
              <p className="g-meta sr-only">
                Picco anomalo: {formatPct(spike.share, 0)} dei page view ({W}) è senza paese, soglia {formatPct(NO_COUNTRY_SPIKE_SHARE, 0)}.
              </p>
            )}

            <p className="g-meta pb-6">
              Fonte: {meta.origin}. Solo aggregati, nessun dato personale (referrer ridotti al dominio, codici referral mascherati). Definizioni in core/sql.ts.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
