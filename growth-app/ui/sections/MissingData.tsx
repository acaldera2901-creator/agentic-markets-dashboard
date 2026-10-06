// «Dati che non abbiamo ancora»: every MISSING_KPIS entry, grouped by the
// tracking gap (content/tracking-gaps.json) whose `unlocks` names it, with
// what it takes and who unblocks it. A KPI never sits in the place of a
// number here: no 0, no dash, a lock and the words «non misurato».

import { type Family, MISSING_KPIS, type MissingKpi } from "@/core/kpi";
import type { TrackingGap } from "../work/content";
import { Chip, LockIcon, SectionTitle, fmtInt } from "../primitives";

export const FAMILY_LABEL: Record<Family, string> = {
  acquisition: "Acquisition",
  activation: "Activation",
  revenue: "Revenue",
  retention: "Retention",
  quality: "Product Quality",
};

export const FAMILY_ID: Record<Family, string> = {
  acquisition: "acquisition",
  activation: "activation",
  revenue: "revenue",
  retention: "retention",
  quality: "product-quality",
};

interface Group {
  gap: TrackingGap | null;
  kpis: MissingKpi[];
}

/** Group the missing KPIs by the first gap that lists them in `unlocks`; the rest go in a last group without a gap. */
export function groupByGap(gaps: TrackingGap[], missing: MissingKpi[] = MISSING_KPIS): Group[] {
  const groups = new Map<string, Group>();
  const orphans: MissingKpi[] = [];
  for (const m of missing) {
    const gap = gaps.find((g) => g.unlocks.includes(m.label));
    if (!gap) {
      orphans.push(m);
      continue;
    }
    if (!groups.has(gap.id)) groups.set(gap.id, { gap, kpis: [] });
    groups.get(gap.id)!.kpis.push(m);
  }
  const out = [...groups.values()].sort((a, b) => a.gap!.priority.localeCompare(b.gap!.priority) || a.gap!.id.localeCompare(b.gap!.id));
  if (orphans.length > 0) out.push({ gap: null, kpis: orphans });
  return out;
}

export function MissingData({ gaps, workHref }: { gaps: TrackingGap[]; workHref?: string }) {
  const groups = groupByGap(gaps);
  const closed = gaps.filter((g) => g.status === "chiuso").length;
  const mitigated = gaps.filter((g) => g.status === "mitigato").length;
  const inProgress = gaps.filter((g) => g.status === "in corso").length;
  return (
    <section aria-labelledby="mancanti" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8 flex flex-col gap-2">
          <SectionTitle id="mancanti" title={`Dati che non abbiamo ancora · ${MISSING_KPIS.length} KPI`} />
          <p className="g-caveat">
            Nessuno di questi ha un numero: non sono 0, non sono trattini. Ogni riga dice cosa serve e chi lo sblocca; il lavoro per chiuderli è in{" "}
            {workHref ? <a href={`${workHref}#gap`}>Lavoro → Tracking gaps</a> : "Lavoro → Tracking gaps"}.
          </p>
        </div>
        <div className="g-card lg:col-span-4 p-4">
          <div className="g-label">
            Gap di tracking: {fmtInt(closed)} {closed === 1 ? "chiuso" : "chiusi"} su {fmtInt(gaps.length)}
          </div>
          <div className="g-bar" role="img" aria-label={`${closed} gap chiusi su ${gaps.length}`}>
            <span style={{ width: `${gaps.length ? (closed / gaps.length) * 100 : 0}%` }} />
          </div>
          <div className="g-meta mt-2">
            {fmtInt(inProgress)} in corso · {fmtInt(mitigated)} {mitigated === 1 ? "mitigato" : "mitigati"} · {fmtInt(gaps.length - closed - mitigated - inProgress)} aperti
            {workHref && (
              <>
                {" "}
                · <a href={`${workHref}#gap`}>Apri in Lavoro →</a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="g-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_130px_120px_minmax(0,1.6fr)] gap-3 px-4 py-2 g-meta">
          <span>KPI</span>
          <span>Sezione</span>
          <span>Stato</span>
          <span>Cosa serve · chi sblocca</span>
        </div>
        {groups.map((g, gi) => (
          <div key={g.gap?.id ?? "senza-gap"} className={gi > 0 ? "g-rule" : ""}>
            <div className="g-card--flat px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {g.gap ? (
                <>
                  <span className="g-h g-h--mini">
                    {g.gap.id} · {g.gap.title}
                  </span>
                  <span className="g-prio" data-p={g.gap.priority}>
                    {g.gap.priority}
                  </span>
                  <span className="g-meta">sblocca: {g.gap.owner}</span>
                  <span className="g-meta">· {g.gap.status}</span>
                  {workHref && (
                    <a className="g-meta" href={`${workHref}#${g.gap.id}`}>
                      dettagli in Lavoro →
                    </a>
                  )}
                </>
              ) : (
                <>
                  <span className="g-h g-h--mini">Senza un gap in Lavoro</span>
                  <span className="g-meta">il KPI è nel PDF ma nessun gap di tracking lo elenca ancora</span>
                </>
              )}
            </div>
            <ul>
              {g.kpis.map((m) => (
                <li key={m.label} className="g-rule grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_130px_120px_minmax(0,1.6fr)] gap-x-3 gap-y-1 px-4 py-2.5 min-h-[44px] items-start">
                  <span className="g-label flex items-center gap-2">
                    <LockIcon className="shrink-0 g-muted" />
                    {m.label}
                  </span>
                  <span className="text-[14px]">
                    <a href={`#${FAMILY_ID[m.family]}`} className="g-muted inline-flex items-center min-h-[24px]">
                      {FAMILY_LABEL[m.family]}
                    </a>
                  </span>
                  <span>
                    <Chip mark="MANCA" />
                  </span>
                  <span className="g-caveat max-w-none">
                    {m.needs} · <span className="g-ink">sblocca: {m.owner}</span>
                    <span className="block g-meta">Perché manca: {m.why}.</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
