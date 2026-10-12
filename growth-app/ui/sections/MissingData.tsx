// «Data we do not have yet»: every MISSING_KPIS entry, grouped by the
// tracking gap (content/tracking-gaps.json) whose `unlocks` names it, with
// what it takes and who unblocks it. A KPI never sits in the place of a
// number here: no 0, no dash, a lock and the words «not measured».

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
  const closed = gaps.filter((g) => g.status === "closed").length;
  const mitigated = gaps.filter((g) => g.status === "mitigated").length;
  const inProgress = gaps.filter((g) => g.status === "in progress").length;
  return (
    <section aria-labelledby="missing" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8 flex flex-col gap-2">
          <SectionTitle id="missing" title={`Data we do not have yet · ${MISSING_KPIS.length} KPIs`} />
          <p className="g-caveat">
            None of these has a number: they are not 0, they are not dashes. Each row says what it needs and who unblocks it; the work to close them is in{" "}
            {workHref ? <a href={`${workHref}#gap`}>Work → Tracking gaps</a> : "Work → Tracking gaps"}.
          </p>
        </div>
        <div className="g-card lg:col-span-4 p-4">
          <div className="g-label">
            Tracking gaps: {fmtInt(closed)} closed of {fmtInt(gaps.length)}
          </div>
          <div className="g-bar" role="img" aria-label={`${closed} gaps closed of ${gaps.length}`}>
            <span style={{ width: `${gaps.length ? (closed / gaps.length) * 100 : 0}%` }} />
          </div>
          <div className="g-meta mt-2">
            {fmtInt(inProgress)} in progress · {fmtInt(mitigated)} mitigated · {fmtInt(gaps.length - closed - mitigated - inProgress)} open
            {workHref && (
              <>
                {" "}
                · <a href={`${workHref}#gap`}>Open in Work →</a>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="g-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_130px_120px_minmax(0,1.6fr)] gap-3 px-4 py-2 g-meta">
          <span>KPI</span>
          <span>Section</span>
          <span>Status</span>
          <span>What it needs · who unblocks it</span>
        </div>
        {groups.map((g, gi) => (
          <div key={g.gap?.id ?? "no-gap"} className={gi > 0 ? "g-rule" : ""}>
            <div className="g-card--flat px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {g.gap ? (
                <>
                  <span className="g-h g-h--mini">
                    {g.gap.id} · {g.gap.title}
                  </span>
                  <span className="g-prio" data-p={g.gap.priority}>
                    {g.gap.priority}
                  </span>
                  <span className="g-meta">unblocks: {g.gap.owner}</span>
                  <span className="g-meta">· {g.gap.status}</span>
                  {workHref && (
                    <a className="g-meta" href={`${workHref}#${g.gap.id}`}>
                      details in Work →
                    </a>
                  )}
                </>
              ) : (
                <>
                  <span className="g-h g-h--mini">Without a gap in Work</span>
                  <span className="g-meta">the KPI is in the PDF but no tracking gap lists it yet</span>
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
                    {m.needs} · <span className="g-ink">unblocks: {m.owner}</span>
                    <span className="block g-meta">Why it is missing: {m.why}.</span>
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
