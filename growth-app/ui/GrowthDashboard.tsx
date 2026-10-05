// The whole dashboard as one presentational component: no auth, no data
// loading, no router. The host (this app's page, or the CRM later) passes the
// data, where it came from, and how to build a link for another window.
// Ported from PR #516 (app/admin/growth/page.tsx).

import type { ReactNode } from "react";
import {
  type Family,
  type GrowthWindow,
  type KpiStatus,
  MISSING_KPIS,
  WINDOWS,
  formatAge,
  formatPct,
  funnelLinks,
  ratio,
  splitPaying,
  windowLabel,
} from "@/core/kpi";
import type { GrowthData, Result, SourceMeta } from "@/core/model";
import { Channels } from "./sections/Channels";
import { Trends } from "./sections/Trends";

export interface GrowthDashboardProps {
  data: GrowthData;
  meta: SourceMeta;
  /** URL for the same dashboard on another window, e.g. (w) => `?w=${w}`. */
  hrefFor: (w: GrowthWindow) => string;
  /** Optional link to the work page (/lavoro in the standalone app); omitted → no link. */
  workHref?: string;
}

// ─── UI primitives (same palette as /admin) ──────────────────────────────────

const STATUS_STYLE: Record<KpiStatus, string> = {
  LIVE: "bg-emerald-950 text-emerald-300 border-emerald-800",
  PROXY: "bg-amber-950 text-amber-300 border-amber-800",
  MANCA: "bg-gray-800 text-gray-400 border-gray-700",
  ERRORE: "bg-red-950 text-red-300 border-red-800",
};

// "LIVE" in the status model means "counted directly"; shown as MISURATO so a
// snapshot page never carries a badge that reads like "live data".
const STATUS_LABEL: Record<KpiStatus, string> = { LIVE: "MISURATO", PROXY: "PROXY", MANCA: "MANCA", ERRORE: "ERRORE" };

function StatusBadge({ s }: { s: KpiStatus }) {
  return <span className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLE[s]}`}>{STATUS_LABEL[s]}</span>;
}

interface TileProps {
  label: string;
  status: KpiStatus;
  /** null for LIVE/PROXY means "not computable" (denominator 0, empty table) — rendered as n/d, never 0. */
  value?: string | null;
  sub?: string;
  window: string;
  caveat: string;
  needs?: string;
  owner?: string;
}

function Tile({ label, status, value, sub, window, caveat, needs, owner }: TileProps) {
  const dashed = status === "MANCA" ? "border-dashed" : "";
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1.5 ${dashed}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-gray-400 text-xs uppercase tracking-wider">{label}</div>
        <StatusBadge s={status} />
      </div>
      {status === "MANCA" ? (
        <div className="text-sm font-semibold text-gray-500 italic">Non misurato</div>
      ) : status === "ERRORE" ? (
        <div className="text-sm font-semibold text-red-400">Lettura fallita — nessun valore mostrato</div>
      ) : value === null || value === undefined ? (
        <div className="text-sm font-semibold text-gray-400">n/d <span className="font-normal text-gray-500">(non calcolabile: nessun dato su cui dividere o misurare)</span></div>
      ) : (
        <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      )}
      {sub && <div className="text-gray-400 text-xs">{sub}</div>}
      <div className="text-gray-500 text-[11px]">Finestra: {window}</div>
      <div className="text-gray-500 text-[11px] leading-snug">{caveat}</div>
      {needs && (
        <div className="text-[11px] leading-snug text-gray-400 border-t border-gray-800 pt-1.5 mt-0.5">
          <span className="text-gray-500">Serve:</span> {needs}
          {owner && <> · <span className="text-gray-500">sblocca:</span> {owner}</>}
        </div>
      )}
    </div>
  );
}

function errorTile(label: string, window: string): TileProps {
  return { label, status: "ERRORE", window, caveat: "La query è fallita: riprova a ricaricare. Il valore non viene sostituito con 0." };
}

/** Build a tile from a query result; a failed read becomes an ERRORE tile. */
function fromResult<T>(r: Result<T>, label: string, window: string, build: (d: T) => Omit<TileProps, "label" | "window">): TileProps {
  return r.ok ? { label, window, ...build(r.data) } : errorTile(label, window);
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 border-b border-gray-800 pb-2">
        <h2 className="text-white font-semibold">{title}</h2>
        <span className="text-gray-500 text-xs">{hint}</span>
      </div>
      {children}
    </section>
  );
}

function TileGrid({ tiles }: { tiles: TileProps[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  );
}

function SmallTable<T>({
  title,
  status,
  caveat,
  rows,
  cols,
  empty,
}: {
  title: string;
  status: KpiStatus;
  caveat: string;
  rows: Result<T[]>;
  cols: { h: string; get: (r: T) => string | number; right?: boolean }[];
  empty: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-gray-400 text-xs uppercase tracking-wider">{title}</div>
        <StatusBadge s={rows.ok ? status : "ERRORE"} />
      </div>
      <div className="text-gray-500 text-[11px] mb-2 leading-snug">{caveat}</div>
      {!rows.ok ? (
        <div className="text-sm text-red-400">Lettura fallita — nessun valore mostrato</div>
      ) : rows.data.length === 0 ? (
        <div className="text-sm text-gray-500 italic">{empty}</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs">
              {cols.map((c) => (
                <th key={c.h} className={`font-normal pb-1 ${c.right ? "text-right" : "text-left"}`}>{c.h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.data.map((r, i) => (
              <tr key={i} className="border-t border-gray-800">
                {cols.map((c) => (
                  <td key={c.h} className={`py-1 ${c.right ? "text-right tabular-nums text-white" : "text-gray-300 break-all"}`}>{c.get(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function missingTiles(family: Family): TileProps[] {
  return MISSING_KPIS.filter((m) => m.family === family).map((m) => ({
    label: m.label,
    status: "MANCA" as const,
    window: "—",
    caveat: `Perché manca: ${m.why}.`,
    needs: m.needs,
    owner: m.owner,
  }));
}

const fmtInt = (n: number) => n.toLocaleString("it-IT");
const fmtUsd = (n: number) => `$${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Page ────────────────────────────────────────────────────────────────────

export function GrowthDashboard({ data: d, meta, hrefFor, workHref }: GrowthDashboardProps) {
  const w = d.window;
  const W = windowLabel(w);
  const isSnapshot = meta.kind === "snapshot";
  const NOW = isSnapshot ? "al momento dello snapshot" : "adesso (istantanea)";
  const ALL = "da sempre (cumulato)";

  const updated = new Date(meta.asOf).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium" });

  // Share of page_views without session_id in THIS window (measured, not assumed).
  const noSessShare = d.traffic.ok ? formatPct(ratio(d.traffic.data.page_views_no_session, d.traffic.data.page_views), 0) : null;
  const sessCaveat = `Solo traffico con consenso GDPR: ${noSessShare ?? "una parte"} dei page_view nella finestra non ha session_id e non è contato qui.`;

  // ── Funnel ──
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
  const links = funnelLinks(funnelSteps);

  // ── Acquisition ──
  const acquisition: TileProps[] = [
    fromResult(d.traffic, "Page view", W, (t) => ({
      status: "LIVE",
      value: fmtInt(t.page_views),
      sub: `${fmtInt(t.page_views_no_session)} senza session_id (${noSessShare ?? "n/d"})`,
      caveat: "Tutti i page_view registrati, con e senza consenso.",
    })),
    fromResult(d.traffic, "Sessioni", W, (t) => ({ status: "PROXY", value: fmtInt(t.sessions), caveat: sessCaveat })),
    fromResult(d.traffic, "Sessioni /tools", W, (t) => ({
      status: "PROXY",
      value: fmtInt(t.tools_sessions),
      caveat: `Sessioni con almeno un page_view su /tools* (anche con prefisso lingua). ${sessCaveat}`,
    })),
    fromResult(d.traffic, "Sessioni /predictions", W, (t) => ({
      status: "PROXY",
      value: fmtInt(t.predictions_sessions),
      caveat: `Sessioni con almeno un page_view su /predictions* (pagine partita incluse). ${sessCaveat}`,
    })),
    fromResult(d.newProfiles, "Nuovi signup con referral", W, (p) => ({
      status: "LIVE",
      value: fmtInt(p.referred),
      sub: `su ${fmtInt(p.new_profiles)} nuovi profili`,
      caveat: "Profili creati nella finestra con referred_by valorizzato (creator / invito).",
    })),
    ...missingTiles("acquisition"),
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
    fromResult(d.funnelEvents, "Signup completati (eventi)", W, (f) => ({
      status: "PROXY",
      value: fmtInt(f.signup_completed),
      sub: `${fmtInt(f.signup_started)} avviati · ${formatPct(ratio(f.signup_completed, f.signup_started), 0) ?? "n/d"} completati`,
      caveat: `Conteggio eventi client: può divergere dai profili creati (doppi invii, blocchi del beacon). ${fmtInt(f.signup_no_session)} eventi signup senza sessione.`,
    })),
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
    fromResult(d.funnelEvents, "Card aperte per sessione", W, (f) => ({
      status: "PROXY",
      value: f.card_open_sessions > 0 ? (f.card_open / f.card_open_sessions).toFixed(1) : null,
      sub: `${fmtInt(f.card_open)} card_open in ${fmtInt(f.card_open_sessions)} sessioni`,
      caveat: "Proxy di engagement, non di attivazione: card_open per sessione che ne ha aperta almeno una.",
    })),
    ...missingTiles("activation"),
  ];

  // ── Revenue ──
  const paying = d.plans.ok ? splitPaying(d.plans.data) : null;
  const revenue: TileProps[] = [
    paying
      ? {
          label: "Paganti verificati",
          status: "LIVE",
          value: fmtInt(paying.verified),
          window: NOW,
          caveat: "Piano base/premium da un canale a pagamento (Paygate, PayPal, Shopify, Stripe) e non scaduto. Esclusi comp/team/regali.",
        }
      : errorTile("Paganti verificati", NOW),
    paying
      ? {
          label: "Paganti (incl. comp)",
          status: "PROXY",
          value: fmtInt(paying.inclComp),
          sub: `${fmtInt(paying.comp)} comp/manuali/senza fonte · ${fmtInt(paying.expiredNotSwept)} scaduti non ancora declassati`,
          window: NOW,
          caveat: "Tutti i base/premium. Gonfiato dagli account omaggio: usare «Paganti verificati» per decidere.",
        }
      : errorTile("Paganti (incl. comp)", NOW),
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
    fromResult(d.shopify, "Ordini Shopify pagati", W, (s) => ({
      status: "PROXY",
      value: fmtInt(s.orders_w),
      sub: `importo ${s.amount_w.toLocaleString("it-IT", { minimumFractionDigits: 2 })} (valuta negozio) · da sempre: ${fmtInt(s.orders_all)} ordini, ${s.amount_all.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
      caveat: "shopify_events orders/paid. Importo nella valuta del negozio, non convertito in USD; rimborsi non sottratti.",
    })),
    fromResult(d.revenue, "Quota annuale", ALL, (r) => ({
      status: "LIVE",
      value: formatPct(ratio(r.annual_all, r.orders_all), 0),
      sub: `${fmtInt(r.annual_all)} annuali su ${fmtInt(r.orders_all)} ordini pagati`,
      caveat: "Solo Paygate e PayPal (period). Shopify e Stripe non registrano il periodo qui. Campione piccolo.",
    })),
    fromResult(d.funnelEvents, "Click partner (affiliate)", W, (f) => ({
      status: "LIVE",
      value: fmtInt(f.partner_click),
      sub: `${fmtInt(f.partner_menu_open)} aperture menu · ${formatPct(ratio(f.partner_click, f.partner_menu_open), 0) ?? "n/d"} click/aperture`,
      caveat: "Solo click in uscita: le conversioni del partner non tornano a noi. I click possono arrivare anche fuori dal menu.",
    })),
    ...missingTiles("revenue"),
  ];

  // ── Retention ──
  const retention: TileProps[] = [
    fromResult(d.lapsed, "Abbonamenti pagati scaduti", W, (l) => ({
      status: "PROXY",
      value: fmtInt(Number(l.lapsed)),
      caveat: "Profili da canale a pagamento con plan_expires_at nella finestra e non rinnovati. È un conteggio di scadenze, non un churn rate.",
    })),
    ...missingTiles("retention"),
  ];

  // ── Product quality ──
  const quality: TileProps[] = [
    fromResult(d.calibration, "Brier (servito)", "ultimi 20.000 pronostici chiusi", (c) => ({
      status: "LIVE",
      value: c.brier === null ? null : c.brier.toFixed(4),
      sub: `n = ${fmtInt(c.n)} · più basso è meglio`,
      caveat: "Stessa definizione di /api/research/calibration (blocco served). Non dipende dalla finestra selezionata.",
    })),
    fromResult(d.calibration, "ECE (servito)", "ultimi 20.000 pronostici chiusi", (c) => ({
      status: "LIVE",
      value: c.ece === null ? null : c.ece.toFixed(4),
      sub: "errore di calibrazione medio, 10 bin",
      caveat: "Media su casa/pareggio/trasferta di |probabilità prevista − frequenza osservata|.",
    })),
    fromResult(d.freshness, "Freschezza quote", NOW, (f) => ({
      status: "PROXY",
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
    ...missingTiles("quality"),
  ];

  const counts = { LIVE: 0, PROXY: 0, MANCA: 0, ERRORE: 0 } as Record<KpiStatus, number>;
  for (const t of [...acquisition, ...activation, ...revenue, ...retention, ...quality]) counts[t.status]++;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">BetRedge</span>
          <span className="bg-emerald-900 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-medium">GROWTH</span>
          <span className="text-gray-500 text-xs">sola lettura</span>
          {workHref && (
            <a href={workHref} className="text-sm text-gray-400 hover:text-white underline underline-offset-4 decoration-gray-700">
              Lavoro →
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1" aria-label="Finestra temporale">
            {WINDOWS.map((x) => (
              <a
                key={x.key}
                href={hrefFor(x.key)}
                aria-current={x.key === w ? "page" : undefined}
                className={`px-3 py-1 rounded-md text-sm ${x.key === w ? "bg-emerald-900 text-emerald-200" : "text-gray-400 hover:text-white"}`}
              >
                {x.label}
              </a>
            ))}
          </nav>
          {!isSnapshot && (
            <div className="text-right">
              <div className="text-gray-300 text-xs">Ultimo aggiornamento: <span className="font-semibold">{updated}</span></div>
              <div className="text-gray-500 text-[11px]">letto dal DB a questo caricamento · <a href={hrefFor(w)} className="underline hover:text-white">ricarica</a></div>
            </div>
          )}
        </div>
      </header>

      {isSnapshot && (
        <div role="status" className="bg-amber-950 border-b-2 border-amber-600 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-amber-200 font-bold text-base">Snapshot del {updated} (ora di Roma) — non live</span>
            <span className="text-amber-300/80 text-xs">
              I numeri sono fermi a quell&apos;istante e non si aggiornano ricaricando. Le finestre (Oggi / 7 / 30 giorni) contano all&apos;indietro da quel momento. Fonte: {meta.origin}.
            </span>
          </div>
        </div>
      )}

      <main className="px-4 sm:px-6 py-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
          <span><StatusBadge s="LIVE" /> contato dal DB, significa quello che dice ({counts.LIVE})</span>
          <span><StatusBadge s="PROXY" /> dal DB ma approssima il KPI: leggi il caveat ({counts.PROXY})</span>
          <span><StatusBadge s="MANCA" /> il dato non esiste ancora: niente numero ({counts.MANCA})</span>
          {counts.ERRORE > 0 && <span><StatusBadge s="ERRORE" /> lettura fallita ({counts.ERRORE})</span>}
        </div>

        <Section title="Funnel" hint={`visitatore → signup → pagante · ${W}`}>
          {!funnelOk ? (
            <div className="bg-gray-900 border border-red-800 rounded-xl p-4 text-sm text-red-400">Lettura del funnel fallita — nessun valore mostrato.</div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-400 text-xs uppercase tracking-wider">Funnel parziale</div>
                <StatusBadge s="PROXY" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {funnelSteps.map((s, i) => (
                  <div key={s.label} className="border border-gray-800 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">{s.label}</div>
                    <div className="text-2xl font-bold tabular-nums">{fmtInt(s.value)}</div>
                    <div className="text-gray-500 text-[11px]">{s.unit}</div>
                    {i > 0 && (
                      <div className="text-xs mt-1 text-amber-300">
                        {links[i - 1].rate === null ? (
                          <span className="text-gray-400">n/d — il passo precedente è 0</span>
                        ) : (
                          <>{formatPct(links[i - 1].rate)} <span className="text-gray-500">dal passo precedente</span></>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-[11px] mt-3 leading-snug">
                PROXY: i passi hanno unità diverse (sessioni con consenso → eventi → righe DB → ordini) e non sono legati alla stessa persona, quindi i rapporti sono indicativi.
                {" "}{sessCaveat} Gli ordini contano anche rinnovi di clienti già esistenti; Stripe non registra ordini con importo nel DB.
              </p>
            </div>
          )}
        </Section>

        <Section title="Acquisition" hint="da dove arrivano">
          <TileGrid tiles={acquisition} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SmallTable
              title="Sessioni per fonte"
              status="PROXY"
              caveat={`Una fonte per sessione (utm_source, poi src/crm/ref/referrer del page_view d'ingresso). ${sessCaveat} Top 15.`}
              rows={d.sources}
              cols={[{ h: "Fonte", get: (r) => r.source }, { h: "Sessioni", get: (r) => fmtInt(Number(r.sessions)), right: true }]}
              empty="Nessuna sessione con consenso nella finestra."
            />
            <SmallTable
              title="Nuovi signup per canale"
              status="LIVE"
              caveat="profiles.acquisition dei profili creati nella finestra. «(non registrata)» = profilo senza dato di acquisizione (i profili storici sono tutti così)."
              rows={d.channels}
              cols={[{ h: "Canale", get: (r) => r.channel }, { h: "Signup", get: (r) => fmtInt(Number(r.n)), right: true }]}
              empty="Nessun nuovo profilo nella finestra."
            />
            <SmallTable
              title="Widget sui siti partner"
              status="LIVE"
              caveat="widget_view / widget_click per host dichiarato dal widget. Esclusi localhost e anteprime *.vercel.app."
              rows={d.widget}
              cols={[
                { h: "Host", get: (r) => r.host },
                { h: "View", get: (r) => fmtInt(Number(r.views)), right: true },
                { h: "Click", get: (r) => fmtInt(Number(r.clicks)), right: true },
              ]}
              empty="Nessuna visualizzazione del widget nella finestra."
            />
          </div>
        </Section>

        <Trends data={d} /><Channels data={d} />

        <Section title="Activation" hint="chi si iscrive e inizia a usarlo">
          <TileGrid tiles={activation} />
        </Section>

        <Section title="Revenue" hint="chi paga e quanto">
          <TileGrid tiles={revenue} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SmallTable
              title="Click per partner"
              status="LIVE"
              caveat="Eventi partner_click per partner_id nella finestra. Top 10."
              rows={d.partners}
              cols={[{ h: "Partner", get: (r) => r.partner_id }, { h: "Click", get: (r) => fmtInt(Number(r.clicks)), right: true }]}
              empty="Nessun click partner nella finestra."
            />
          </div>
        </Section>

        <Section title="Retention" hint="chi resta">
          <TileGrid tiles={retention} />
        </Section>

        <Section title="Product Quality" hint="il prodotto regge?">
          <TileGrid tiles={quality} />
        </Section>

        <p className="text-gray-600 text-[11px] pb-6">
          Fonte: {meta.origin}. Solo aggregati, nessun dato personale (referrer ridotti al dominio, codici referral mascherati). Definizioni in core/sql.ts.
        </p>
      </main>
    </div>
  );
}
