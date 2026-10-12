// «Today in 30 seconds»: what changed (the top rows of the deltas and anomalies
// that core/series already computes for Trends) and what not to trust in
// this window. No new number is computed here: every figure is one that the
// page shows elsewhere, brought to the top.

import type { ReactNode } from "react";
import { NO_COUNTRY_SPIKE_SHARE, noCountrySpike } from "@/core/estimate";
import { formatPct } from "@/core/kpi";
import type { GrowthData } from "@/core/model";
import { type Anomaly, SERIES_METRICS, SMALL_SAMPLE_BASE, type SeriesMetric, anomalies, compare, knownNoise, windowDays } from "@/core/series";
import { Chip, type Mark, fmtDay, fmtInt, fmtSigned } from "../primitives";

const SHOWN = 4;

/** The series mark follows the tile it feeds: the estimate is ≈, consented sessions approximate «Sessions» (◐), the rest is counted. */
const SERIES_MARK: Partial<Record<SeriesMetric, Mark>> = { probably_human: "EST", sessions: "PROXY" };

export interface TodayProps {
  data: GrowthData;
  windowLabel: string;
  /** Tiles whose read failed on this page (ERRORE), to say so up front. */
  errorCount: number;
  /** Share of page views without session_id in this window, already formatted (null = read failed). */
  noSessShare: string | null;
  /** Snapshot pages say that the numbers are frozen. */
  snapshotLabel?: string;
  missingCount: number;
  missingHref: string;
}

interface Row {
  key: SeriesMetric;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
  smallSample: boolean;
  an: Anomaly[];
}

export function Today({ data, windowLabel, errorCount, noSessShare, snapshotLabel, missingCount, missingHref }: TodayProps) {
  const n = windowDays(data.window);
  const s = data.trends;
  const rows: Row[] = [];
  let failed = 0;
  for (const m of SERIES_METRICS) {
    const v = s.values[m.key];
    if (!v) {
      failed++;
      continue;
    }
    const c = compare(v, n);
    rows.push({ key: m.key, label: m.label, ...c, an: anomalies(v, s.days, n) });
  }
  // Anomalous metrics first (strongest σ), then the biggest absolute movement.
  // Anomalies on days the audit found ours/synthetic (core/series.ts KNOWN_NOISE)
  // do not lead the ranking: they stay visible with their note, nothing is excluded.
  const topZ = (r: Row) => Math.max(0, ...r.an.filter((a) => !knownNoise(r.key, a.day)).map((a) => Math.abs(a.z)));
  const ranked = [...rows].sort((a, b) => topZ(b) - topZ(a) || Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current).slice(0, SHOWN);
  const anomalyCount = rows.reduce((k, r) => k + r.an.length, 0);

  // «Don't trust»: the limits that invalidate a plain reading of this window.
  const spike = data.humanTraffic.ok ? noCountrySpike(data.humanTraffic.data.excl_no_country, data.humanTraffic.data.page_views) : null;
  const warnings: { glyph: "▲" | "△" | "·"; text: ReactNode }[] = [];
  if (spike?.spike && data.humanTraffic.ok) {
    warnings.push({
      glyph: "▲",
      text: (
        <>
          <b>{formatPct(spike.share, 0)} of the page views ({windowLabel}) have no country</b> ({fmtInt(data.humanTraffic.data.excl_no_country)} of{" "}
          {fmtInt(data.humanTraffic.data.page_views)}, threshold {formatPct(NO_COUNTRY_SPIKE_SHARE, 0)}): read «probably human», not the raw numbers. No country = local
          tests, synthetic jobs or crawlers, cause not determinable from the data.
        </>
      ),
    });
  }
  if (errorCount > 0) {
    warnings.push({ glyph: "△", text: <><b>{errorCount} {errorCount === 1 ? "failed read" : "failed reads"}</b> on the page: the value is missing, it was not replaced with 0.</> });
  }
  if (failed > 0) {
    warnings.push({ glyph: "△", text: <><b>{failed} daily series not read</b>: their Trends rows stay empty, not at 0.</> });
  }
  if (noSessShare !== null) {
    warnings.push({
      glyph: "·",
      text: <><b>{noSessShare} of the page views ({windowLabel}) have no session_id</b>: sessions, session sources and signups by source count only consented traffic.</>,
    });
  }
  warnings.push({
    glyph: "▲",
    text: (
        <>
          <b>Part of the traffic and of the events is probably ours or synthetic</b> (Oct 7 audit): team sessions, cards and partner clicks, the synthetic
          burst of signups started on Oct 6 at 04:09, the synthetic sessions of Sep 24, the test signups of Sep 21. None of them is excluded from the counts: a
          spike on those days is not growth.
        </>
    ),
  });
  warnings.push({ glyph: "·", text: <><b>Stage counts</b>: different units per step, no conversion can be computed.</> });
  if (ranked.some((r) => r.smallSample)) {
    warnings.push({ glyph: "·", text: <>Previous period below {SMALL_SAMPLE_BASE} events on some rows: absolute delta only, no percentage.</> });
  }
  if (snapshotLabel) {
    warnings.push({ glyph: "·", text: <><b>Numbers frozen at the snapshot of {snapshotLabel}</b>: reloading does not update them.</> });
  }

  return (
    <section aria-labelledby="today" className="flex flex-col gap-4">
      <h2 id="today" className="g-h g-h--page">
        {data.window === "today" ? "Today" : windowLabel} in 30 seconds
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="g-card lg:col-span-7 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="g-h g-h--card">What changed</h3>
            <span className="g-meta">
              last {n} full days vs the previous {n} · today excluded because partial
            </span>
          </div>
          {ranked.length === 0 ? (
            <p className="g-caveat">No daily series read: nothing to compare (no value replaced with 0).</p>
          ) : (
            <ol className="flex flex-col">
              {ranked.map((r) => (
                <li
                  key={r.key}
                  className="g-rule grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 items-center md:grid-cols-[minmax(0,1fr)_64px_minmax(200px,1fr)_auto]"
                  data-change={r.key}
                >
                  <span className="g-label">{r.label}</span>
                  <span className="g-num g-num--md justify-self-end">{fmtInt(r.current)}</span>
                  <span className="g-meta col-span-2 md:col-span-1 g-tab">
                    <span className="g-ink font-semibold">
                      {r.delta === 0 ? "=" : r.delta > 0 ? "▲ " : "▼ "}
                      {r.delta === 0 ? "" : fmtSigned(r.delta)}
                    </span>
                    {r.pct !== null && (
                      <span>
                        {" "}
                        ({r.pct > 0 ? "+" : ""}
                        {(r.pct * 100).toFixed(0)}%)
                      </span>
                    )}
                    <span> vs {fmtInt(r.previous)} before</span>
                    {r.smallSample && <span> · base &lt; {SMALL_SAMPLE_BASE}, no %</span>}
                    {r.an.map((a) => {
                      const noise = knownNoise(r.key, a.day);
                      return (
                        <span key={a.day} className={noise ? "g-muted block" : "g-anom block"} data-noise={noise ? a.day : undefined}>
                          {a.z > 0 ? "▲" : "▼"} anomaly {fmtDay(a.day)} · {a.z > 0 ? "+" : ""}
                          {a.z.toFixed(1)}σ{noise && <> · not growth: {noise}</>}
                        </span>
                      );
                    })}
                  </span>
                  <span className="justify-self-end">
                    <Chip mark={SERIES_MARK[r.key] ?? "LIVE"} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="g-meta">
            The same rows, with the day-by-day trend, in <a href="#trends">Trends</a>. Anomaly = beyond 2σ from the mean of the 14 days before.
          </p>
        </div>
        <aside className="g-card lg:col-span-5 p-4 flex flex-col gap-3" style={{ borderLeft: "4px solid var(--anomaly)" }} aria-labelledby="dont-trust">
          <h3 id="dont-trust" className="g-h g-h--card">
            Don&apos;t trust
          </h3>
          <ul className="flex flex-col gap-2.5">
            {warnings.map((w, i) => (
              <li key={i} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[14px] leading-snug">
                <span aria-hidden="true" className={w.glyph === "▲" ? "g-anom" : w.glyph === "△" ? "font-semibold" : "g-muted"} style={w.glyph === "△" ? { color: "var(--s-err)" } : undefined}>
                  {w.glyph}
                </span>
                <span className="g-caveat" style={{ color: "var(--ink)" }}>
                  {w.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="g-rule pt-3 mt-auto text-[14px]">
            <span className="font-semibold">
              {anomalyCount} {anomalyCount === 1 ? "anomaly" : "anomalies"} in the last {n} days
            </span>
            <span className="g-muted"> · </span>
            <a href={missingHref}>{missingCount} KPIs not measured →</a>
          </p>
        </aside>
      </div>
    </section>
  );
}
