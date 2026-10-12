// Filone A — daily series, comparison with the previous period, anomalies.
// Presentational only: receives the normalized series (or nothing) and renders.

import { HUMAN_ESTIMATE_MARGIN, HUMAN_FILTER_CRITERIA, NO_COUNTRY_SPIKE_SHARE, noCountrySpike } from "@/core/estimate";
import type { GrowthData } from "@/core/model";
import { ANOMALY_BASELINE_DAYS, ANOMALY_SIGMA, type Anomaly, SERIES_METRICS, SMALL_SAMPLE_BASE, anomalies, compare, knownNoise, windowDays } from "@/core/series";
import { CLIENT_ERROR_DEDUP_SECONDS } from "@/core/sql";
import { Chip, SectionTitle, Why, fmtDay, fmtInt, fmtSigned } from "../primitives";

/** Inline SVG sparkline: one series, anomalous days ringed + labelled, native hover per point. */
function Sparkline({ values, days, flagged }: { values: number[]; days: string[]; flagged: Set<number> }) {
  const W = 168;
  const H = 36;
  const P = 4;
  const max = Math.max(1, ...values);
  const x = (i: number) => P + (values.length === 1 ? 0 : (i * (W - 2 * P)) / (values.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`trend, maximum ${fmtInt(max)}`} className="overflow-visible">
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="g-spark-base" strokeWidth={1} />
      <polyline points={pts} fill="none" className="g-spark-line" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={days[i]}>
          {flagged.has(i) && <circle cx={x(i)} cy={y(v)} r={4.5} className="g-spark-ring" strokeWidth={2} />}
          {/* invisible, larger hit target for the native tooltip */}
          <circle cx={x(i)} cy={y(v)} r={6} fill="transparent">
            <title>{`${fmtDay(days[i])}: ${fmtInt(v)}${flagged.has(i) ? " — anomaly" : ""}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

function AnomalyNote({ a, noise }: { a: Anomaly; noise: string | null }) {
  return (
    <li className="g-anom text-[12px] font-medium">
      {a.z > 0 ? "▲" : "▼"} {fmtDay(a.day)}: {fmtInt(a.value)} <span className="g-muted font-normal">(mean of the {ANOMALY_BASELINE_DAYS}d before {a.mean.toFixed(1)} ± {a.sd.toFixed(1)}, {a.z > 0 ? "+" : ""}
      {a.z.toFixed(1)}σ){noise && <> · not growth: {noise} (Oct 7 audit, not excluded from the counts)</>}</span>
    </li>
  );
}

const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

export function Trends({ data }: { data: GrowthData }) {
  const n = windowDays(data.window);
  const s = data.trends;
  const shown = s.days.slice(s.days.length - n);
  const rows = SERIES_METRICS.map((m) => {
    const v = s.values[m.key];
    if (!v) return { m, v: null, c: null, an: [] as Anomaly[] };
    return { m, v, c: compare(v, n), an: anomalies(v, s.days, n) };
  });
  const cur = (k: string) => rows.find((r) => r.m.key === k)?.c?.current ?? null;
  const human = cur("probably_human");
  const raw = cur("page_views");
  const noCountry = cur("page_views_no_country");
  const spike = raw !== null && noCountry !== null ? noCountrySpike(noCountry, raw) : null;

  return (
    <section aria-labelledby="trends" className="flex flex-col gap-3">
      <SectionTitle id="trends" title="Daily trends" hint={`last ${n} full days vs the previous ${n}`} />
      <p className="text-[14px] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Page views, last {n}d: <span className="g-num g-num--sm">{human === null ? "n/a" : fmtInt(human)}</span> probably human
        </span>
        <Chip mark="EST" />
        <span className="g-muted">· {raw === null ? "n/a" : fmtInt(raw)} raw</span>
        <Chip mark="LIVE" />
      </p>
      <p className="g-meta" data-sub="estimate margin">
        Margin of the estimate: {HUMAN_ESTIMATE_MARGIN}.
      </p>
      {spike?.spike && (
        <div role="alert" className="g-card px-4 py-3 text-[14px]" style={{ borderLeft: "4px solid var(--anomaly)" }}>
          <span className="g-anom">▲</span> Anomalous spike, check before reading the totals: {pct(spike.share!)} of the page views of the last {n} days have no country (threshold{" "}
          {pct(NO_COUNTRY_SPIKE_SHARE)}).
        </div>
      )}
      <Why label="why, and how to read it">
        Raw page views also contain crawlers, synthetic jobs and traffic without country: for people read the «probably human» row (ESTIMATED, same criterion
        as the card in Acquisition: {HUMAN_FILTER_CRITERIA.map((c, i) => `${i + 1}) ${c}`).join("; ")}). The raw number stays next to it. Calendar days in the
        Europe/Rome time zone, from {fmtDay(shown[0])} to {fmtDay(shown[shown.length - 1])}; today is excluded because partial. A day without events is 0 only if the read
        succeeded: if the query fails the row stays empty. With a previous period below {SMALL_SAMPLE_BASE} events there is only the absolute delta (small
        sample). <b>Anomaly</b> = a day beyond {ANOMALY_SIGMA} standard deviations (σ) from the mean of the {ANOMALY_BASELINE_DAYS} days before, only with ≥
        {ANOMALY_BASELINE_DAYS} days of history since the first recorded value; σ is the sample standard deviation of those {ANOMALY_BASELINE_DAYS} days, z = (value −
        mean) / σ.
      </Why>
      <div className="g-card p-4 g-scroll">
        <table className="g-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="r">Last {n}d</th>
              <th className="r">{n}d before</th>
              <th className="r">Delta</th>
              <th>Trend</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, v, c, an }) => (
              <tr key={m.key}>
                <td className="whitespace-nowrap">
                  <span className="g-ink">{m.label}</span>
                  {m.key === "sessions" && <div className="g-meta">sum of each day&apos;s sessions</div>}
                  {m.key === "probably_human" && (
                    <div className="g-meta">
                      <Chip mark="EST" /> excluded: no country, countries without sessions, bursts
                    </div>
                  )}
                  {m.key === "page_views" && (
                    <div className="g-meta">
                      <Chip mark="LIVE" /> crawlers and no-country included
                    </div>
                  )}
                  {m.key === "page_views_no_country" && <div className="g-meta">local tests, synthetic jobs or crawlers</div>}
                  {m.key === "client_error" && <div className="g-meta">identical duplicates within {CLIENT_ERROR_DEDUP_SECONDS} s counted once</div>}
                  {m.key === "paid_orders" && <div className="g-meta">orders from internal/test accounts excluded</div>}
                </td>
                {v && c ? (
                  <>
                    <td className="r g-num g-num--sm">{fmtInt(c.current)}</td>
                    <td className="r g-muted">{fmtInt(c.previous)}</td>
                    <td className="r whitespace-nowrap">
                      <span className="font-semibold">{fmtSigned(c.delta)}</span>
                      {c.pct !== null && (
                        <span className="g-muted">
                          {" "}
                          ({c.pct > 0 ? "+" : ""}
                          {(c.pct * 100).toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td>
                      <Sparkline values={v.slice(v.length - n)} days={shown} flagged={new Set(an.map((a) => a.index - (v.length - n)))} />
                    </td>
                    <td className="min-w-[180px]">
                      {c.smallSample && (
                        <div className="g-meta">
                          small sample (base {fmtInt(c.previous)} &lt; {SMALL_SAMPLE_BASE}): no %
                        </div>
                      )}
                      {c.partialHistory && <div className="g-meta">the previous period starts before the first recorded value</div>}
                      {an.length > 0 && (
                        <details className="g-why">
                          <summary>
                            <span className="g-anom">▲ {an.length === 1 ? "1 anomaly" : `${an.length} anomalies`}</span> <span className="g-caret" aria-hidden="true">▸</span>
                          </summary>
                          <ul className="g-why-body flex flex-col gap-1">
                            {an.map((a) => (
                              <AnomalyNote key={a.day} a={a} noise={knownNoise(m.key, a.day)} />
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="text-[12px]" style={{ color: "var(--s-err)" }}>
                    <Chip mark="ERRORE" /> Read failed ({s.errors[m.key] ?? "error"}) — empty series, no value replaced with 0.
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="g-card g-why p-4">
        <summary>
          Day-by-day table <span className="g-caret" aria-hidden="true">▸</span>
        </summary>
        <div className="g-scroll mt-3">
          <table className="g-table text-[12px] g-tab">
            <thead>
              <tr>
                <th>Day</th>
                {SERIES_METRICS.map((m) => (
                  <th key={m.key} className="r">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((d, j) => {
                const i = s.days.length - n + j;
                return (
                  <tr key={d}>
                    <td className="g-muted whitespace-nowrap">{fmtDay(d)}</td>
                    {rows.map(({ m, v, an }) => (
                      <td key={m.key} className={`r ${an.some((a) => a.index === i) ? "g-anom" : ""}`}>
                        {v ? fmtInt(v[i]) : ""}
                        {an.filter((a) => a.index === i).map((a) => (a.z > 0 ? " ▲" : " ▼"))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
