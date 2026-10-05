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
  { key: "today", label: "Oggi" },
  { key: "7d", label: "7 giorni" },
  { key: "30d", label: "30 giorni" },
];

export function parseWindow(raw: string | string[] | undefined): GrowthWindow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "today" || v === "7d" || v === "30d" ? v : "7d";
}

// SQL expression for the start of the window. Returned from a closed set of
// constants — the user-supplied value never reaches the SQL string.
// "Oggi" is the calendar day in Europe/Rome (the team's day), not the last 24h.
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
  n: number;
}

export interface PayingSplit {
  /** base/premium from a paid channel and not expired. */
  verified: number;
  /** every base/premium row, comps and not-yet-swept expiries included. */
  inclComp: number;
  /** base/premium granted manually / by referral / with no recorded source. */
  comp: number;
  /** paid channel but plan_expires_at already passed (cron not yet run). */
  expiredNotSwept: number;
  free: number;
  /** admin_full: team accounts, never counted as customers. */
  team: number;
}

export function splitPaying(rows: PlanRow[]): PayingSplit {
  const out: PayingSplit = { verified: 0, inclComp: 0, comp: 0, expiredNotSwept: 0, free: 0, team: 0 };
  const paid = new Set<string>(PAID_CHANNELS);
  for (const r of rows) {
    const n = Number(r.n) || 0;
    if (r.plan === "free") out.free += n;
    else if (r.plan === "admin_full") out.team += n;
    else if (r.plan === "base" || r.plan === "premium") {
      out.inclComp += n;
      if (!paid.has(r.plan_source ?? "")) out.comp += n;
      else if (r.expired) out.expiredNotSwept += n;
      else out.verified += n;
    }
  }
  return out;
}

/** Ratio as a fraction, or null when the denominator is 0 — never a fake 0%. */
export function ratio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

export function formatPct(r: number | null, digits = 1): string | null {
  return r === null ? null : `${(r * 100).toFixed(digits)}%`;
}

export function formatAge(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.floor(seconds));
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 86400)}g ${Math.floor((s % 86400) / 3600)}h`;
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
  { label: "Sessioni", pdfKpi: "Organic sessions", needs: "conteggio delle sessioni anche senza consenso (G13) e fonte organica separata (Search Console, G05)", gaps: ["G13", "G05"], owner: "Calde" },
  { label: "Sessioni /tools", pdfKpi: "Tool sessions", needs: "conteggio delle sessioni anche senza consenso (G13)", gaps: ["G13"], owner: "Calde" },
  { label: "Sessioni /predictions", pdfKpi: "Match page sessions", needs: "conteggio delle sessioni anche senza consenso (G13)", gaps: ["G13"], owner: "Calde" },
  { label: "Card aperte per sessione", pdfKpi: "Signup → 3 analyses/week", needs: "id utente stabile negli events (G01) + definizione di «analisi» ed evento analysis_viewed (G02)", gaps: ["G01", "G02"], owner: "Calde" },
  { label: "Abbonamenti pagati scaduti", pdfKpi: "Monthly churn", needs: "log storico degli stati abbonamento, per avere i paganti a inizio periodo (G08)", gaps: ["G08"], owner: "Calde" },
  { label: "Freschezza quote", pdfKpi: "Odds latency", needs: "timestamp della quota alla fonte accanto a captured_at (G09)", gaps: ["G09"], owner: "Calde" },
];

export function proxyTile(label: string): ProxyTile {
  const t = PROXY_TILES.find((x) => x.label === label);
  if (!t) throw new Error(`tile PROXY senza voce in PROXY_TILES: ${label}`);
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
  { family: "acquisition", label: "CAC per canale", why: "nessuna spesa per canale registrata", needs: "costo per canale (ads, creator, affiliate) in una tabella o foglio collegato", owner: "Andrea" },
  { family: "activation", label: "WAA (utenti attivi settimanali)", why: "events non ha un id utente stabile: session_id è per sessione e solo con consenso", needs: "id utente pseudonimo stabile negli events per gli utenti loggati", owner: "Calde" },
  { family: "activation", label: "3 analisi / settimana", why: "events non lega le azioni a un utente", needs: "id utente negli events + definizione di «analisi» (card_open? match aperto?)", owner: "Calde" },
  { family: "activation", label: "Watchlist create", why: "la watchlist vive solo nel localStorage del browser", needs: "evento watchlist_add tracciato o watchlist salvata lato server", owner: "Calde" },
  { family: "activation", label: "Primo alert impostato", why: "la funzione alert non esiste", needs: "feature alert + evento alert_set", owner: "Tommy" },
  { family: "retention", label: "Alert aperti", why: "la funzione alert non esiste", needs: "feature alert + evento alert_opened", owner: "Tommy" },
  { family: "retention", label: "Retention D7 / D30 / M3", why: "senza id utente negli events non si sa chi torna", needs: "id utente stabile negli events (vedi WAA)", owner: "Calde" },
  { family: "retention", label: "Utenti di ritorno", why: "session_id cambia a ogni sessione: un ritorno è indistinguibile da un nuovo visitatore", needs: "id visitatore persistente (con consenso) o id utente per i loggati", owner: "Calde" },
  { family: "retention", label: "Churn rate", why: "esiste solo il conteggio delle scadenze (tile PROXY «Abbonamenti pagati scaduti»), non il denominatore storico dei paganti", needs: "storico giornaliero dei paganti (snapshot) per calcolare la base di inizio periodo", owner: "Calde" },
  { family: "revenue", label: "MRR", why: "events.value è sempre 0; Stripe non salva importi nel DB; Shopify senza normalizzazione periodo/valuta", needs: "importo + periodo + valuta per ogni abbonamento attivo, da tutti i canali", owner: "Andrea" },
  { family: "revenue", label: "ARPU", why: "dipende dall'MRR, che manca", needs: "MRR (sopra)", owner: "Andrea" },
  { family: "revenue", label: "Trial → paid", why: "non esiste un trial", needs: "un trial nel prodotto + evento trial_started", owner: "Andrea" },
  { family: "revenue", label: "Revenue affiliate per utente", why: "registriamo solo i click, non le conversioni dei partner", needs: "report conversioni/commissioni dei partner (postback o export)", owner: "Tommy" },
  { family: "quality", label: "Uptime %", why: "nessun monitor esterno che registri la storia della disponibilità", needs: "uptime monitor con storico (es. check periodico salvato)", owner: "Calde" },
  { family: "quality", label: "Latenza quote", why: "abbiamo solo l'età dell'ultima quota salvata, non il ritardo rispetto al bookmaker", needs: "timestamp sorgente del bookmaker accanto a captured_at", owner: "Calde" },
  { family: "quality", label: "Accuratezza del tracking", why: "nessun riconciliatore fra events e fonti esterne (pagamenti, Vercel analytics)", needs: "job che confronti signup/ordini negli events con profiles/ordini", owner: "Calde" },
  { family: "quality", label: "CLV verificato", why: "copertura della closing line all'1,8% (misurata il 17/09): troppo bassa per un numero onesto", needs: "cattura sistematica delle quote di chiusura", owner: "Calde" },
];
