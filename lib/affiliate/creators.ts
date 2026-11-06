// lib/affiliate/creators.ts — #CREATOR-OFFERS-1031 (B)
// KPI mensili per creator dalla vista affiliate_creator_monthly (migration
// 20261102120000): query + raggruppamento per creator + totali per coorte e mese
// (il confronto umani/agenti di dicembre).
import { dbQueryStrict } from "@/lib/db";

export const COHORTS = ["standard", "creator_human", "creator_agent"] as const;
export type Cohort = (typeof COHORTS)[number];

export type MonthKpi = {
  month: string; // YYYY-MM (UTC)
  clicks: number;
  signups: number;
  activated: number;
  paying: number;
  mrr_usd: number;
  commission_usd: number;
  shadow_rows: number;
};
const METRICS = ["clicks", "signups", "activated", "paying", "mrr_usd", "commission_usd", "shadow_rows"] as const;

export type Row = {
  affiliate_id: number;
  code: string;
  cohort: Cohort;
  identifier: string;
  pro_grant_expires_at: string | null;
  month: string | null;
} & Partial<Omit<MonthKpi, "month">>;

export type CreatorKpi = {
  affiliate_id: number;
  code: string;
  cohort: Cohort;
  identifier: string;
  pro_grant_expires_at: string | null;
  months: MonthKpi[];
};

/** Righe (affiliato × mese, mese null = nessuna attività nella finestra) → per creator + totali coorte/mese. */
export function groupCreatorKpis(rows: Row[]): { creators: CreatorKpi[]; cohorts: Record<string, MonthKpi[]> } {
  const byId = new Map<number, CreatorKpi>();
  const totals = new Map<string, Map<string, MonthKpi>>();
  for (const r of rows) {
    let c = byId.get(r.affiliate_id);
    if (!c) {
      c = { affiliate_id: r.affiliate_id, code: r.code, cohort: r.cohort, identifier: r.identifier, pro_grant_expires_at: r.pro_grant_expires_at, months: [] };
      byId.set(r.affiliate_id, c);
    }
    if (!r.month) continue;
    const m = { month: r.month } as MonthKpi;
    for (const k of METRICS) m[k] = Number(r[k] ?? 0);
    c.months.push(m);
    const perCohort = totals.get(r.cohort) ?? new Map<string, MonthKpi>();
    totals.set(r.cohort, perCohort);
    const t = perCohort.get(r.month) ?? ({ month: r.month, ...Object.fromEntries(METRICS.map((k) => [k, 0])) } as MonthKpi);
    for (const k of METRICS) t[k] = Math.round((t[k] + m[k]) * 100) / 100;
    perCohort.set(r.month, t);
  }
  const cohorts: Record<string, MonthKpi[]> = {};
  for (const [cohort, months] of totals) cohorts[cohort] = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const c of byId.values()) c.months.sort((a, b) => a.month.localeCompare(b.month));
  return { creators: [...byId.values()], cohorts };
}

/** Tutti gli affiliati della coorte (null = tutte), anche senza attività, con gli ultimi `months` mesi UTC. */
export async function loadCreatorKpis(cohort: Cohort | null, months: number) {
  const rows = await dbQueryStrict<Row>(
    `SELECT a.id AS affiliate_id, a.code, a.cohort, a.identifier, g.expires_at AS pro_grant_expires_at,
            to_char(m.month, 'YYYY-MM') AS month, m.clicks, m.signups, m.activated, m.paying,
            m.mrr_usd, m.commission_usd, m.shadow_rows
       FROM affiliates a
       LEFT JOIN affiliate_creator_monthly m
         ON m.affiliate_id = a.id
        AND m.month >= (date_trunc('month', now() AT TIME ZONE 'UTC') - make_interval(months => $2::int - 1))::date
       LEFT JOIN creator_grants g ON g.identifier = a.identifier
      WHERE ($1::text IS NULL OR a.cohort = $1::text)
      ORDER BY a.id, m.month`,
    [cohort, months],
  );
  return groupCreatorKpis(rows);
}
